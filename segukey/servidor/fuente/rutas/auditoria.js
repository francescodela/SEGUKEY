// fuente/rutas/auditoria.js
// GET /api/logs          → registro de actividad (Admin / Tester)
// GET /api/alertas       → alertas del sistema (Admin)
// GET /api/metricas      → métricas del dashboard (Admin)
const express = require('express');
const pool    = require('../basededatos/conexion');
const { authMiddleware, requireRole } = require('../intermediario/autenticacion');

const router = express.Router();
router.use(authMiddleware);

/* ---- GET /api/logs ---- */
// query param: ?nivel=Warning|Error|Info
router.get('/logs', requireRole('Administrador', 'Tester'), async (req, res) => {
    const { nivel } = req.query;
    try {
        const baseQuery = `
            SELECT ra.id,
                   COALESCE(u.nombre || ' ' || u.apellido, 'Sistema') AS usuario,
                   u.rol,
                   ra.accion, ra.modulo, ra.nivel, ra.resultado, ra.ip, ra.fecha_hora
            FROM registro_actividad ra
            LEFT JOIN usuario u ON ra.usuario_id = u.id
            ${nivel ? 'WHERE ra.nivel = $1' : ''}
            ORDER BY ra.fecha_hora DESC
            LIMIT 200`;

        const { rows } = nivel
            ? await pool.query(baseQuery, [nivel])
            : await pool.query(baseQuery);

        res.json({ ok: true, data: rows });
    } catch (err) {
        res.status(500).json({ ok: false, msg: 'Error al obtener logs.' });
    }
});

/* ---- GET /api/alertas ---- */
// query param: ?estado=Pendiente|Revisada|Resuelta
router.get('/alertas', requireRole('Administrador'), async (req, res) => {
    const { estado } = req.query;
    try {
        const { rows } = await pool.query(
            `SELECT a.*, COALESCE(u.nombre || ' ' || u.apellido, '—') AS usuario_nombre
             FROM alerta a
             LEFT JOIN usuario u ON a.usuario_id = u.id
             ${estado ? 'WHERE a.estado = $1' : ''}
             ORDER BY a.fecha_hora DESC`,
            estado ? [estado] : []
        );
        res.json({ ok: true, data: rows });
    } catch (err) {
        res.status(500).json({ ok: false, msg: 'Error al obtener alertas.' });
    }
});

/* ---- GET /api/metricas ---- */
router.get('/metricas', requireRole('Administrador', 'Tester'), async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT * FROM vista_metricas_admin`);
        res.json({ ok: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ ok: false, msg: 'Error al obtener métricas.' });
    }
});

module.exports = router;
