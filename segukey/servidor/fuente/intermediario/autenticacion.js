// fuente/intermediario/autenticacion.js
// Verifica el JWT en el header Authorization: Bearer <token>
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ ok: false, msg: 'Token no proporcionado.' });
    }

    const token = header.split(' ')[1];
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload; // { id, nombre, apellido, correo, rol }
        next();
    } catch (err) {
        return res.status(401).json({ ok: false, msg: 'Token inválido o expirado.' });
    }
}

// Verifica que el usuario tenga uno de los roles permitidos
function requireRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user?.rol)) {
            return res.status(403).json({ ok: false, msg: 'Acceso no autorizado para tu rol.' });
        }
        next();
    };
}

module.exports = { authMiddleware, requireRole };
