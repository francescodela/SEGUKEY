// fuente/rutas/usuarios.js
// GET    /api/usuarios          → listar todos (Admin)
// GET    /api/usuarios/:id      → obtener uno
// POST   /api/usuarios          → crear (Admin)
// PUT    /api/usuarios/:id      → editar (Admin)
// DELETE /api/usuarios/:id      → eliminar (Admin)
const express  = require('express');
const bcrypt   = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const pool     = require('../basededatos/conexion');
const { authMiddleware, requireRole } = require('../intermediario/autenticacion');

const router = express.Router();
router.use(authMiddleware);

async function registrarLog(usuario_id, accion, modulo = 'Database', nivel = 'Info', resultado = 'Exitoso') {
    try {
        await pool.query(
            `INSERT INTO registro_actividad (usuario_id, accion, modulo, nivel, resultado)
             VALUES ($1,$2,$3,$4,$5)`,
            [usuario_id || null, accion, modulo, nivel, resultado]
        );
    } catch (_) {}
}

/* ---- GET /api/usuarios ---- */
router.get('/', requireRole('Administrador'), async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, nombre, apellido, correo, codigo_autorizacion, rol, estado,
                    permiso_ver_archivos, permiso_editar_usuarios, permiso_ver_auditoria,
                    telefono, area_departamento, cargo, fecha_creacion, ultimo_acceso
             FROM usuario ORDER BY id`
        );
        res.json({ ok: true, data: rows });
    } catch (err) {
        res.status(500).json({ ok: false, msg: 'Error al obtener usuarios.' });
    }
});

/* ---- GET /api/usuarios/:id ---- */
router.get('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    // Un usuario solo puede ver su propio perfil, a menos que sea Admin
    if (req.user.rol !== 'Administrador' && req.user.id !== id) {
        return res.status(403).json({ ok: false, msg: 'No tienes permiso.' });
    }
    try {
        const { rows } = await pool.query(
            `SELECT id, nombre, apellido, correo, codigo_autorizacion, rol, estado,
                    permiso_ver_archivos, permiso_editar_usuarios, permiso_ver_auditoria,
                    telefono, area_departamento, cargo, fecha_creacion, ultimo_acceso
             FROM usuario WHERE id = $1`,
            [id]
        );
        if (!rows[0]) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });
        res.json({ ok: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ ok: false, msg: 'Error al obtener usuario.' });
    }
});

/* ---- POST /api/usuarios ---- */
router.post('/', requireRole('Administrador'), [
    body('nombre').notEmpty().trim(),
    body('apellido').notEmpty().trim(),
    body('correo').isEmail(),
    body('contrasena').isLength({ min: 6 }),
    body('rol').isIn(['Administrador', 'Empleado', 'Tester']),
    body('codigo_autorizacion').notEmpty(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, msg: errors.array()[0].msg || 'Datos inválidos.', errors: errors.array() });
    }

    const {
        nombre, apellido, correo, contrasena, codigo_autorizacion, rol, estado,
        permiso_ver_archivos, permiso_editar_usuarios, permiso_ver_auditoria,
        telefono, area_departamento, cargo
    } = req.body;

    try {
        const existe = await pool.query(`SELECT id FROM usuario WHERE correo = $1`, [correo]);
        if (existe.rows.length > 0) {
            return res.status(409).json({ ok: false, msg: 'Ya existe un usuario con ese correo.' });
        }

        const hash = await bcrypt.hash(contrasena, 10);

        const { rows } = await pool.query(
            `INSERT INTO usuario (nombre, apellido, correo, contrasena, codigo_autorizacion, rol,
                estado, permiso_ver_archivos, permiso_editar_usuarios, permiso_ver_auditoria,
                telefono, area_departamento, cargo)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             RETURNING id, nombre, apellido, correo, rol, estado, codigo_autorizacion,
                       permiso_ver_archivos, permiso_editar_usuarios, permiso_ver_auditoria,
                       telefono, area_departamento, cargo, fecha_creacion`,
            [nombre, apellido, correo, hash, codigo_autorizacion,
             rol, estado || 'Activo',
             !!permiso_ver_archivos, !!permiso_editar_usuarios, !!permiso_ver_auditoria,
             telefono || null, area_departamento || null, cargo || null]
        );

        await registrarLog(req.user.id, `Creación de usuario: ${nombre} ${apellido} (${rol})`);
        res.status(201).json({ ok: true, data: rows[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, msg: 'Error al crear usuario.' });
    }
});

/* ---- PUT /api/usuarios/:id ---- */
router.put('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    // Solo Admin puede editar cualquier usuario; otros solo su propio perfil
    if (req.user.rol !== 'Administrador' && req.user.id !== id) {
        return res.status(403).json({ ok: false, msg: 'No tienes permiso.' });
    }

    const {
        nombre, apellido, correo, contrasena, contrasena_actual, estado,
        permiso_ver_archivos, permiso_editar_usuarios, permiso_ver_auditoria,
        telefono, area_departamento, cargo
    } = req.body;

    try {
        // Verificar que existe
        const check = await pool.query(`SELECT id, contrasena, rol FROM usuario WHERE id = $1`, [id]);
        if (!check.rows[0]) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });

        // Verificar correo único si viene en el body
        if (correo) {
            const dup = await pool.query(`SELECT id FROM usuario WHERE correo = $1 AND id != $2`, [correo, id]);
            if (dup.rows.length > 0) return res.status(409).json({ ok: false, msg: 'Ese correo ya está en uso.' });
        }

        // Construir SET dinámico
        const sets = [];
        const vals = [];
        let i = 1;

        const add = (col, val) => { sets.push(`${col} = $${i++}`); vals.push(val); };

        if (nombre    !== undefined) add('nombre', nombre);
        if (apellido  !== undefined) add('apellido', apellido);
        if (correo    !== undefined) add('correo', correo);
        if (contrasena) {
            // Si quien edita NO es Admin, debe confirmar su contraseña actual
            if (req.user.rol !== 'Administrador') {
                if (!contrasena_actual) {
                    return res.status(400).json({ ok: false, msg: 'Debes ingresar tu contraseña actual.' });
                }
                const coincide = await bcrypt.compare(contrasena_actual, check.rows[0].contrasena);
                if (!coincide) {
                    return res.status(401).json({ ok: false, msg: 'La contraseña actual no es correcta.' });
                }
            }
            const hash = await bcrypt.hash(contrasena, 10);
            add('contrasena', hash);
        }
        // Solo Admin puede cambiar estado y permisos
        if (req.user.rol === 'Administrador') {
            if (estado                    !== undefined) add('estado', estado);
            if (permiso_ver_archivos      !== undefined) add('permiso_ver_archivos', !!permiso_ver_archivos);
            if (permiso_editar_usuarios   !== undefined) add('permiso_editar_usuarios', !!permiso_editar_usuarios);
            if (permiso_ver_auditoria     !== undefined) add('permiso_ver_auditoria', !!permiso_ver_auditoria);
        }
        if (telefono          !== undefined) add('telefono', telefono);
        if (area_departamento !== undefined) add('area_departamento', area_departamento);
        if (cargo             !== undefined) add('cargo', cargo);
        add('fecha_actualizacion', new Date());

        vals.push(id);
        const { rows } = await pool.query(
            `UPDATE usuario SET ${sets.join(', ')} WHERE id = $${i}
             RETURNING id, nombre, apellido, correo, rol, estado, codigo_autorizacion,
                       permiso_ver_archivos, permiso_editar_usuarios, permiso_ver_auditoria,
                       telefono, area_departamento, cargo, fecha_creacion, ultimo_acceso`,
            vals
        );

        await registrarLog(req.user.id, `Edición de usuario ID ${id}: ${rows[0].nombre} ${rows[0].apellido}`);
        res.json({ ok: true, data: rows[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, msg: 'Error al actualizar usuario.' });
    }
});

/* ---- DELETE /api/usuarios/:id ---- */
router.delete('/:id', requireRole('Administrador'), async (req, res) => {
    const id = parseInt(req.params.id);
    if (id === 1) return res.status(400).json({ ok: false, msg: 'No se puede eliminar el administrador principal.' });

    try {
        const { rows } = await pool.query(`DELETE FROM usuario WHERE id = $1 RETURNING nombre, apellido`, [id]);
        if (!rows[0]) return res.status(404).json({ ok: false, msg: 'Usuario no encontrado.' });

        await registrarLog(req.user.id, `Eliminación de usuario: ${rows[0].nombre} ${rows[0].apellido}`, 'Database', 'Warning');
        res.json({ ok: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, msg: 'Error al eliminar usuario.' });
    }
});

module.exports = router;
