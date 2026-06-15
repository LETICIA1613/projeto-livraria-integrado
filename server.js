// ============================================================
//  HamStore Backend  –  server.js
//  Porta padrão: 3001
//  Dependências: npm install express mysql2 bcryptjs jsonwebtoken cors dotenv google-auth-library
// ============================================================

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const authRouter = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares ───────────────────────────────────────────────
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',   // restrinja em produção
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ── Rotas ─────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// Health-check
app.get('/api/ping', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Erro 404
app.use((_req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

// ── Erro global ───────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('[ERRO GLOBAL]', err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
});

app.listen(PORT, () => console.log(`🚀 HamStore API rodando em http://localhost:${PORT}`));
