// fuente/servidor.js
// Punto de entrada principal de la API REST de Segukey
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const path     = require('path');

// Rutas
const rutasAutenticacion = require('./rutas/autenticacion');
const rutasUsuarios      = require('./rutas/usuarios');
const rutasRespaldos     = require('./rutas/respaldos');
const rutasAuditoria     = require('./rutas/auditoria');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ---- Middlewares globales ---- */
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---- Archivos subidos (almacenamiento local) ---- */
app.use('/subidas', express.static(path.join(__dirname, '..', 'subidas')));

/* ---- Health check ---- */
app.get('/api/salud', (req, res) => {
    res.json({ ok: true, msg: 'Segukey API corriendo', env: process.env.NODE_ENV });
});

/* ---- Rutas de la API ---- */
app.use('/api/auth',      rutasAutenticacion);
app.use('/api/usuarios',  rutasUsuarios);
app.use('/api/respaldos', rutasRespaldos);
app.use('/api',           rutasAuditoria);   // /api/logs, /api/alertas, /api/metricas

/* ---- Manejo de rutas no encontradas ---- */
app.use((req, res) => {
    res.status(404).json({ ok: false, msg: `Ruta ${req.method} ${req.path} no encontrada.` });
});

/* ---- Manejo global de errores ---- */
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(500).json({ ok: false, msg: 'Error interno del servidor.' });
});

/* ---- Iniciar servidor ---- */
app.listen(PORT, () => {
    console.log(`\n🔐 Segukey API corriendo en http://localhost:${PORT}`);
    console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   DB:       ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}\n`);
});
