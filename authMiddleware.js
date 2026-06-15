// ============================================================
//  middlewares/authMiddleware.js
//  Uso: router.get('/rota-protegida', autenticar, handler)
// ============================================================

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'hamstore_secret_troque_em_producao';

function autenticar(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer '))
        return res.status(401).json({ erro: 'Token de autenticação não fornecido.' });

    const token = authHeader.slice(7);
    try {
        req.usuario = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
}

module.exports = { autenticar };
