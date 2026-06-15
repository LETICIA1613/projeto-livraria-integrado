// ============================================================
//  routes/auth.js
//
//  POST /api/auth/cadastro  – Cria usuário + dados_usuarios
//  POST /api/auth/login     – Login com e-mail / senha
//  POST /api/auth/google    – Login / cadastro via Google OAuth
// ============================================================

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const pool    = require('../db');

const JWT_SECRET     = process.env.JWT_SECRET     || 'hamstore_secret_troque_em_producao';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '1053140413223-8cihjbbj23g4k19qhj3k1s8e7u837b7m.apps.googleusercontent.com';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ── Utilitários ───────────────────────────────────────────────

/** Gera JWT com payload mínimo */
function gerarToken(usuario) {
    return jwt.sign(
        { id: usuario.id_usuario, tipo: usuario.tipo },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/** Valida formato de e-mail */
function emailValido(email) {
    return /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(email);
}

/** Validações básicas do cadastro */
function validarCadastro({ nome_usuario, email, senha, data_nasc }) {
    if (!nome_usuario || nome_usuario.trim().length < 3)
        return 'Nome de usuário deve ter no mínimo 3 caracteres.';
    if (!emailValido(email))
        return 'E-mail inválido.';
    if (!senha || senha.length < 6)
        return 'A senha deve ter no mínimo 6 caracteres.';
    if (!data_nasc)
        return 'Data de nascimento é obrigatória.';
    const nasc = new Date(data_nasc);
    if (isNaN(nasc.getTime()))
        return 'Data de nascimento inválida.';
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    if (idade < 12) return 'Você precisa ter pelo menos 12 anos para se cadastrar.';
    return null;
}

// ── POST /api/auth/cadastro ───────────────────────────────────
router.post('/cadastro', async (req, res) => {
    const { nome_usuario, email, senha, data_nasc } = req.body;

    // 1. Validação local
    const erroValidacao = validarCadastro({ nome_usuario, email, senha, data_nasc });
    if (erroValidacao) return res.status(400).json({ erro: erroValidacao });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 2. Verifica duplicidade de nome_usuario
        const [existeNome] = await conn.query(
            'SELECT id_usuario FROM usuarios WHERE nome_usuario = ? LIMIT 1',
            [nome_usuario.trim()]
        );
        if (existeNome.length > 0)
            return res.status(409).json({ erro: 'Nome de usuário já está em uso.' });

        // 3. Verifica duplicidade de e-mail em dados_usuarios
        const [existeEmail] = await conn.query(
            'SELECT id_dados_usuario FROM dados_usuarios WHERE email = ? LIMIT 1',
            [email.trim().toLowerCase()]
        );
        if (existeEmail.length > 0)
            return res.status(409).json({ erro: 'E-mail já cadastrado.' });

        // 4. Hash da senha
        const senhaHash = await bcrypt.hash(senha, 12);

        // 5. Insere em `usuarios`
        const [resultUsuario] = await conn.query(
            `INSERT INTO usuarios (nome_usuario, senha, ativo, tipo)
             VALUES (?, ?, 1, 'cliente')`,
            [nome_usuario.trim(), senhaHash]
        );
        const id_usuario = resultUsuario.insertId;

        // 6. Insere em `dados_usuarios`
        await conn.query(
            `INSERT INTO dados_usuarios
                (id_usuario, email, data_nascimento, recebe_promo, recebe_notificacao)
             VALUES (?, ?, ?, 0, 1)`,
            [id_usuario, email.trim().toLowerCase(), data_nasc]
        );

        await conn.commit();

        // 7. Gera token e responde
        const usuarioPayload = { id_usuario, nome_usuario: nome_usuario.trim(), tipo: 'cliente' };
        const token = gerarToken({ id_usuario, tipo: 'cliente' });

        res.status(201).json({ token, usuario: usuarioPayload });

    } catch (err) {
        await conn.rollback();
        console.error('[/cadastro]', err);
        res.status(500).json({ erro: 'Erro interno ao criar conta.' });
    } finally {
        conn.release();
    }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha)
        return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
    if (!emailValido(email))
        return res.status(400).json({ erro: 'Formato de e-mail inválido.' });

    try {
        // 1. Busca usuário via JOIN entre usuarios e dados_usuarios
        const [rows] = await pool.query(
            `SELECT u.id_usuario, u.nome_usuario, u.senha, u.ativo, u.tipo,
                    du.nome_completo, du.email
             FROM usuarios u
             INNER JOIN dados_usuarios du ON du.id_usuario = u.id_usuario
             WHERE du.email = ?
             LIMIT 1`,
            [email.trim().toLowerCase()]
        );

        if (rows.length === 0)
            return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });

        const usuario = rows[0];

        // 2. Conta ativa?
        if (!usuario.ativo)
            return res.status(403).json({ erro: 'Conta desativada. Entre em contato com o suporte.' });

        // 3. Compara senha
        const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
        if (!senhaCorreta)
            return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });

        // 4. Responde com token
        const token = gerarToken(usuario);
        res.json({
            token,
            usuario: {
                id_usuario:    usuario.id_usuario,
                nome_usuario:  usuario.nome_usuario,
                nome_completo: usuario.nome_completo,
                email:         usuario.email,
                tipo:          usuario.tipo,
            },
        });

    } catch (err) {
        console.error('[/login]', err);
        res.status(500).json({ erro: 'Erro interno ao fazer login.' });
    }
});

// ── POST /api/auth/google ─────────────────────────────────────
router.post('/google', async (req, res) => {
    const { credential } = req.body;
    if (!credential)
        return res.status(400).json({ erro: 'Token do Google não fornecido.' });

    try {
        // 1. Verifica o token com o Google
        const ticket = await googleClient.verifyIdToken({
            idToken:  credential,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name, given_name, sub: googleSub } = payload;

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // 2. Verifica se já existe pelo e-mail
            const [rows] = await conn.query(
                `SELECT u.id_usuario, u.nome_usuario, u.ativo, u.tipo,
                        du.nome_completo, du.email
                 FROM usuarios u
                 INNER JOIN dados_usuarios du ON du.id_usuario = u.id_usuario
                 WHERE du.email = ?
                 LIMIT 1`,
                [email.toLowerCase()]
            );

            let usuario;

            if (rows.length > 0) {
                // Usuário já existe → só loga
                usuario = rows[0];
                if (!usuario.ativo) {
                    await conn.rollback();
                    return res.status(403).json({ erro: 'Conta desativada.' });
                }
            } else {
                // 3. Cadastro automático via Google
                // Gera nome_usuario único a partir do e-mail
                let nomeBase = (given_name || email.split('@')[0])
                    .toLowerCase()
                    .replace(/[^a-z0-9._-]/g, '')
                    .slice(0, 40);

                // Garante unicidade adicionando sufixo numérico se necessário
                let nomeUsuario = nomeBase;
                let sufixo = 1;
                while (true) {
                    const [dup] = await conn.query(
                        'SELECT id_usuario FROM usuarios WHERE nome_usuario = ? LIMIT 1',
                        [nomeUsuario]
                    );
                    if (dup.length === 0) break;
                    nomeUsuario = `${nomeBase}${sufixo++}`;
                }

                // Senha aleatória (usuário não a conhece; pode redefinir depois)
                const senhaAleatoria = await bcrypt.hash(googleSub + JWT_SECRET, 10);

                const [insUsuario] = await conn.query(
                    `INSERT INTO usuarios (nome_usuario, senha, ativo, tipo) VALUES (?, ?, 1, 'cliente')`,
                    [nomeUsuario, senhaAleatoria]
                );
                const id_usuario = insUsuario.insertId;

                await conn.query(
                    `INSERT INTO dados_usuarios
                        (id_usuario, nome_completo, email, recebe_promo, recebe_notificacao)
                     VALUES (?, ?, ?, 0, 1)`,
                    [id_usuario, name || nomeUsuario, email.toLowerCase()]
                );

                usuario = {
                    id_usuario,
                    nome_usuario:  nomeUsuario,
                    nome_completo: name || nomeUsuario,
                    email:         email.toLowerCase(),
                    tipo:          'cliente',
                    ativo:         1,
                };
            }

            await conn.commit();

            const token = gerarToken(usuario);
            res.json({
                token,
                usuario: {
                    id_usuario:    usuario.id_usuario,
                    nome_usuario:  usuario.nome_usuario,
                    nome_completo: usuario.nome_completo,
                    email:         usuario.email,
                    tipo:          usuario.tipo,
                },
            });

        } catch (innerErr) {
            await conn.rollback();
            throw innerErr;
        } finally {
            conn.release();
        }

    } catch (err) {
        console.error('[/google]', err);
        if (err.message?.includes('Token used too late') || err.message?.includes('Invalid token'))
            return res.status(401).json({ erro: 'Token do Google inválido ou expirado.' });
        res.status(500).json({ erro: 'Erro ao autenticar com Google.' });
    }
});

module.exports = router;
