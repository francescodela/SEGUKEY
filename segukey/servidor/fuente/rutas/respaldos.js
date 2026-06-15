// fuente/rutas/respaldos.js
// GET    /api/respaldos          → todos (Admin) / propios (Empleado)
// GET    /api/respaldos/:id      → uno
// POST   /api/respaldos          → crear (metadata, sin archivo físico)
// POST   /api/respaldos/upload   → subir archivo real desde el PC del usuario
// GET    /api/respaldos/:id/descargar → descargar archivo físico
// PUT    /api/respaldos/:id      → actualizar
// DELETE /api/respaldos/:id      → eliminar
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const { body, validationResult } = require('express-validator');
const pool    = require('../basededatos/conexion');
const { authMiddleware, requireRole } = require('../intermediario/autenticacion');

const router = express.Router();
router.use(authMiddleware);

/* ---- Configuración de almacenamiento local de archivos ---- */
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'subidas');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT_TIPO = {
    '.pdf': 'PDF',
    '.doc': 'DOC', '.docx': 'DOC',
    '.xls': 'XLS', '.xlsx': 'XLS', '.csv': 'XLS',
    '.png': 'Imagen', '.jpg': 'Imagen', '.jpeg': 'Imagen', '.gif': 'Imagen', '.webp': 'Imagen',
};
function tipoPorExtension(filename) {
    const ext = path.extname(filename).toLowerCase();
    return EXT_TIPO[ext] || 'Otro';
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userDir = path.join(UPLOAD_DIR, String(req.user.id));
        if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const unique = `${Date.now()}-${safeName}`;
        cb(null, unique);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB, igual que el límite del frontend
});

async function registrarLog(usuario_id, accion, nivel = 'Info', resultado = 'Exitoso') {
    try {
        await pool.query(
            `INSERT INTO registro_actividad (usuario_id, accion, modulo, nivel, resultado)
             VALUES ($1,$2,'Storage',$3,$4)`,
            [usuario_id || null, accion, nivel, resultado]
        );
    } catch (_) {}
}

/* ---- GET /api/respaldos ---- */
router.get('/', async (req, res) => {
    try {
        let rows;
        if (req.user.rol === 'Administrador') {
            // Admin ve todos
            ({ rows } = await pool.query(
                `SELECT r.*, u.nombre || ' ' || u.apellido AS usuario_nombre
                 FROM respaldo r
                 LEFT JOIN usuario u ON r.usuario_id = u.id
                 ORDER BY r.fecha_hora DESC`
            ));
        } else {
            // Empleado solo ve los suyos
            ({ rows } = await pool.query(
                `SELECT * FROM respaldo WHERE usuario_id = $1 ORDER BY fecha_hora DESC`,
                [req.user.id]
            ));
        }
        res.json({ ok: true, data: rows });
    } catch (err) {
        res.status(500).json({ ok: false, msg: 'Error al obtener archivos.' });
    }
});

/* ---- GET /api/respaldos/:id ---- */
router.get('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const { rows } = await pool.query(`SELECT * FROM respaldo WHERE id = $1`, [id]);
        const r = rows[0];
        if (!r) return res.status(404).json({ ok: false, msg: 'Archivo no encontrado.' });
        // Solo el dueño o Admin
        if (req.user.rol !== 'Administrador' && r.usuario_id !== req.user.id) {
            return res.status(403).json({ ok: false, msg: 'No tienes permiso.' });
        }
        res.json({ ok: true, data: r });
    } catch (err) {
        res.status(500).json({ ok: false, msg: 'Error al obtener archivo.' });
    }
});

/* ---- POST /api/respaldos ---- */
router.post('/', [
    body('nombre_archivo').notEmpty().trim(),
    body('tipo').isIn(['PDF', 'DOC', 'XLS', 'Imagen', 'Otro']),
    body('tamano').isInt({ min: 0 }),
    body('ubicacion').notEmpty(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ ok: false, msg: errors.array()[0].msg || 'Datos inválidos.', errors: errors.array() });
    }

    const { nombre_archivo, tipo, tamano, ubicacion, estado, dispositivo } = req.body;
    const ip = req.ip;

    try {
        const { rows } = await pool.query(
            `INSERT INTO respaldo (nombre_archivo, tipo, tamano, ubicacion, estado, usuario_id, dispositivo, ip)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING *`,
            [nombre_archivo, tipo, tamano, ubicacion,
             estado || 'Pendiente', req.user.id,
             dispositivo || 'Web', ip]
        );
        await registrarLog(req.user.id, `Subida de archivo: ${nombre_archivo}`);
        res.status(201).json({ ok: true, data: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, msg: 'Error al crear archivo.' });
    }
});

/* ---- POST /api/respaldos/upload ----
   Subida real de archivo desde el PC del usuario (multipart/form-data, campo "archivo") */
router.post('/upload', upload.single('archivo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, msg: 'No se recibió ningún archivo.' });

    const tamanoKB = Math.ceil(req.file.size / 1024);
    const tipo = tipoPorExtension(req.file.originalname);
    const estado = req.body.estado || 'Pendiente';
    const ubicacion = `/subidas/${req.user.id}/${req.file.filename}`;

    try {
        const { rows } = await pool.query(
            `INSERT INTO respaldo (nombre_archivo, tipo, tamano, ubicacion, estado, usuario_id, dispositivo, ip)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING *`,
            [req.file.originalname, tipo, tamanoKB, ubicacion, estado, req.user.id, 'Web', req.ip]
        );
        await registrarLog(req.user.id, `Subida de archivo: ${req.file.originalname}`);
        res.status(201).json({ ok: true, data: rows[0] });
    } catch (err) {
        console.error(err);
        // limpiar archivo huérfano si falla la BD
        fs.unlink(req.file.path, () => {});
        res.status(500).json({ ok: false, msg: 'Error al guardar el archivo.' });
    }
});

/* ---- GET /api/respaldos/:id/descargar ---- */
router.get('/:id/descargar', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const { rows } = await pool.query(`SELECT * FROM respaldo WHERE id = $1`, [id]);
        const r = rows[0];
        if (!r) return res.status(404).json({ ok: false, msg: 'Archivo no encontrado.' });
        if (req.user.rol !== 'Administrador' && r.usuario_id !== req.user.id) {
            return res.status(403).json({ ok: false, msg: 'No tienes permiso.' });
        }
        if (!r.ubicacion || !r.ubicacion.startsWith('/subidas/')) {
            return res.status(404).json({ ok: false, msg: 'Este archivo no tiene un fichero físico asociado.' });
        }
        const filePath = path.join(UPLOAD_DIR, r.ubicacion.replace('/subidas/', ''));
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ ok: false, msg: 'El archivo físico no existe en el servidor.' });
        }
        await registrarLog(req.user.id, `Descarga de archivo: ${r.nombre_archivo}`);
        res.download(filePath, r.nombre_archivo);
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, msg: 'Error al descargar archivo.' });
    }
});


router.put('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const check = await pool.query(`SELECT * FROM respaldo WHERE id = $1`, [id]);
        const r = check.rows[0];
        if (!r) return res.status(404).json({ ok: false, msg: 'Archivo no encontrado.' });
        if (req.user.rol !== 'Administrador' && r.usuario_id !== req.user.id) {
            return res.status(403).json({ ok: false, msg: 'No tienes permiso.' });
        }

        const { nombre_archivo, tipo, tamano, ubicacion, estado, dispositivo } = req.body;
        const sets = [];
        const vals = [];
        let i = 1;
        const add = (col, val) => { sets.push(`${col} = $${i++}`); vals.push(val); };

        if (nombre_archivo !== undefined) add('nombre_archivo', nombre_archivo);
        if (tipo           !== undefined) add('tipo', tipo);
        if (tamano         !== undefined) add('tamano', tamano);
        if (ubicacion      !== undefined) add('ubicacion', ubicacion);
        if (estado         !== undefined) add('estado', estado);
        if (dispositivo    !== undefined) add('dispositivo', dispositivo);

        vals.push(id);
        const { rows } = await pool.query(
            `UPDATE respaldo SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
            vals
        );
        await registrarLog(req.user.id, `Actualización de archivo ID ${id}: ${rows[0].nombre_archivo}`);
        res.json({ ok: true, data: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, msg: 'Error al actualizar archivo.' });
    }
});

/* ---- DELETE /api/respaldos/:id ---- */
router.delete('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const check = await pool.query(`SELECT * FROM respaldo WHERE id = $1`, [id]);
        const r = check.rows[0];
        if (!r) return res.status(404).json({ ok: false, msg: 'Archivo no encontrado.' });
        if (req.user.rol !== 'Administrador' && r.usuario_id !== req.user.id) {
            return res.status(403).json({ ok: false, msg: 'No tienes permiso.' });
        }
        await pool.query(`DELETE FROM respaldo WHERE id = $1`, [id]);
        // Eliminar también el archivo físico, si existe
        if (r.ubicacion && r.ubicacion.startsWith('/subidas/')) {
            const filePath = path.join(UPLOAD_DIR, r.ubicacion.replace('/subidas/', ''));
            fs.unlink(filePath, () => {});
        }
        await registrarLog(req.user.id, `Eliminación de archivo: ${r.nombre_archivo}`, 'Warning');
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, msg: 'Error al eliminar archivo.' });
    }
});

module.exports = router;
