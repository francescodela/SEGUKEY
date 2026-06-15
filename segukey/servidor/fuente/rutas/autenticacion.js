// fuente/rutas/autenticacion.js
// POST /api/auth/login
// POST /api/auth/register
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool    = require('../basededatos/conexion');

const router = express.Router();

/* ---- Helpers ---- */
function makeToken(user) {
    return jwt.sign(
        { id: user.id, nombre: user.nombre, apellido: user.apellido,
          correo: user.correo, rol: user.rol },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
}

async function registrarLog(pool, usuario_id, accion, modulo = 'Auth', nivel = 'Info', resultado = 'Exitoso', ip = null) {
    try {
        await pool.query(
            `INSERT INTO registro_actividad (usuario_id, accion, modulo, nivel, resultado, ip)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [usuario_id || null, accion, modulo, nivel, resultado, ip]
        );
    } catch (_) { /* el log nunca debe romper la respuesta principal */ }
}

/* ================================================================
   POST /api/auth/login
   Body: { correo, contrasena, rol, codigo_autorizacion }
   ================================================================ */
router.post('/login', [
    body('correo').isEmail().withMessage('Correo inválido.'),
    body('contrasena').notEmpty().withMessage('Contraseña requerida.'),
    body('rol').isIn(['Administrador', 'Empleado', 'Tester']).withMessage('Rol inválido.'),
    body('codigo_autorizacion').notEmpty().withMessage('Código de autorización requerido.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, msg: errors.array()[0].msg || 'Datos inválidos.', errors: errors.array() });
    }

    const { correo, contrasena, rol, codigo_autorizacion } = req.body;
    const ip = req.ip;

    try {
        // Buscar usuario por correo + rol + código
        const { rows } = await pool.query(
            `SELECT * FROM usuario WHERE correo = $1 AND rol = $2 AND codigo_autorizacion = $3`,
            [correo, rol, codigo_autorizacion]
        );

        const user = rows[0];

        if (!user) {
            await registrarLog(pool, null, `Login fallido: ${correo}`, 'Auth', 'Warning', 'Fallido', ip);
            return res.status(401).json({ ok: false, msg: 'Credenciales incorrectas.' });
        }

        if (user.estado === 'Suspendido') {
            await registrarLog(pool, user.id, 'Login bloqueado: cuenta suspendida', 'Auth', 'Warning', 'Bloqueado', ip);
            return res.status(403).json({ ok: false, msg: 'Cuenta suspendida. Contacta al administrador.' });
        }

        // Verificar contraseña con bcrypt
        const passwordOk = await bcrypt.compare(contrasena, user.contrasena);
        if (!passwordOk) {
            await registrarLog(pool, null, `Login fallido (contraseña): ${correo}`, 'Auth', 'Warning', 'Fallido', ip);
            return res.status(401).json({ ok: false, msg: 'Credenciales incorrectas.' });
        }

        // Actualizar ultimo_acceso
        await pool.query(`UPDATE usuario SET ultimo_acceso = NOW() WHERE id = $1`, [user.id]);
        await registrarLog(pool, user.id, 'Inicio de sesión exitoso', 'Auth', 'Info', 'Exitoso', ip);

        // Quitar contraseña de la respuesta
        const { contrasena: _, ...userSafe } = user;
        const token = makeToken(userSafe);

        return res.json({ ok: true, token, user: userSafe });

    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ ok: false, msg: 'Error interno del servidor.' });
    }
});

/* ================================================================
   POST /api/auth/register
   Solo permite crear Administrador o Tester (igual que el prototipo)
   Body: { nombre, apellido, correo, contrasena, rol, codigo_autorizacion, ... }
   ================================================================ */
router.post('/register', [
    body('nombre').notEmpty().trim(),
    body('apellido').notEmpty().trim(),
    body('correo').isEmail(),
    body('contrasena').isLength({ min: 6 }).withMessage('Mínimo 6 caracteres.'),
    body('rol').isIn(['Administrador', 'Tester']).withMessage('Solo se puede registrar Administrador o Tester.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, msg: errors.array()[0].msg || 'Datos inválidos.', errors: errors.array() });
    }

    const { nombre, apellido, correo, contrasena, rol, telefono, cargo } = req.body;

    try {
        // Verificar correo único
        const existe = await pool.query(`SELECT id FROM usuario WHERE correo = $1`, [correo]);
        if (existe.rows.length > 0) {
            return res.status(409).json({ ok: false, msg: 'Ya existe un usuario con ese correo.' });
        }

        const hash = await bcrypt.hash(contrasena, 10);

        // Generar código de autorización único (SK-XXX-000)
        const codigo_autorizacion = 'SK-' + Math.random().toString(36).substring(2, 5).toUpperCase()
            + '-' + Math.floor(Math.random() * 900 + 100);

        const { rows } = await pool.query(
            `INSERT INTO usuario (nombre, apellido, correo, contrasena, codigo_autorizacion, rol,
                estado, permiso_ver_archivos, permiso_editar_usuarios, permiso_ver_auditoria,
                telefono, cargo)
             VALUES ($1,$2,$3,$4,$5,$6,'Activo',FALSE,FALSE,FALSE,$7,$8)
             RETURNING id, nombre, apellido, correo, rol, estado, codigo_autorizacion`,
            [nombre, apellido, correo, hash, codigo_autorizacion, rol, telefono || null, cargo || null]
        );

        const newUser = rows[0];

        // Si es Tester, insertar en tabla tester
        if (rol === 'Tester') {
            await pool.query(
                `INSERT INTO tester (usuario_id, permisos_tecnicos) VALUES ($1, $2)`,
                [newUser.id, 'ejecutar pruebas, ver logs técnicos']
            );
        }

        await registrarLog(pool, null, `Registro de usuario: ${nombre} ${apellido} (${rol})`, 'Database');

        return res.status(201).json({ ok: true, data: newUser });

    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ ok: false, msg: 'Error interno del servidor.' });
    }
});

module.exports = router;
