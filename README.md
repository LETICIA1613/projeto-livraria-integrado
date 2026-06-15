# HamStore – Backend de Autenticação

API REST em **Node.js + Express + MySQL** que integra as páginas `Login.html` e `Cadastro1.html` ao banco `db_livraria1`.

---

## Estrutura de arquivos

```
hamstore-backend/
├── server.js                   ← Ponto de entrada
├── db.js                       ← Pool de conexões MySQL
├── package.json
├── .env.example                ← Copie para .env e preencha
├── routes/
│   └── auth.js                 ← Rotas de autenticação
├── middlewares/
│   └── authMiddleware.js       ← Middleware JWT (use nas rotas protegidas)
└── migrations/
    └── 001_auth_tables.sql     ← Cria/valida tabelas no banco
```

---

## Pré-requisitos

| Ferramenta | Versão mínima |
|-----------|--------------|
| Node.js   | 18.x         |
| MySQL     | 8.0          |

---

## Instalação

```bash
# 1. Instale as dependências
npm install

# 2. Configure o ambiente
cp .env.example .env
# Edite .env com suas credenciais MySQL e um JWT_SECRET forte

# 3. Crie as tabelas (se ainda não existirem)
mysql -u root -p db_livraria1 < migrations/001_auth_tables.sql

# 4. Inicie o servidor
npm start          # produção
npm run dev        # desenvolvimento (nodemon)
```

---

## Endpoints

### `POST /api/auth/cadastro`

Cria um novo usuário cliente.

**Body (JSON):**
```json
{
  "nome_usuario": "joao_silva",
  "email": "joao@email.com",
  "senha": "minimo6",
  "data_nasc": "2000-05-20"
}
```

**Resposta 201:**
```json
{
  "token": "<JWT>",
  "usuario": {
    "id_usuario": 1,
    "nome_usuario": "joao_silva",
    "tipo": "cliente"
  }
}
```

**Erros comuns:**
- `400` – validação falhou (e-mail inválido, senha curta, idade < 12 anos…)
- `409` – nome de usuário ou e-mail já cadastrado

---

### `POST /api/auth/login`

Autentica um usuário com e-mail e senha.

**Body (JSON):**
```json
{
  "email": "joao@email.com",
  "senha": "minimo6"
}
```

**Resposta 200:**
```json
{
  "token": "<JWT>",
  "usuario": {
    "id_usuario": 1,
    "nome_usuario": "joao_silva",
    "nome_completo": null,
    "email": "joao@email.com",
    "tipo": "cliente"
  }
}
```

**Erros comuns:**
- `401` – e-mail ou senha incorretos
- `403` – conta desativada

---

### `POST /api/auth/google`

Login ou cadastro automático via Google OAuth (Google One Tap).

**Body (JSON):**
```json
{
  "credential": "<ID Token do Google>"
}
```

**Resposta 200/201:** mesmo formato de `/login`.

---

## Usando o token JWT nas demais rotas

```javascript
// Frontend
const token = localStorage.getItem('hamstore_token');

fetch('http://localhost:3001/api/alguma-rota-protegida', {
    headers: { 'Authorization': `Bearer ${token}` }
});

// Backend – adicione o middleware:
const { autenticar } = require('./middlewares/authMiddleware');
router.get('/rota-protegida', autenticar, (req, res) => {
    // req.usuario = { id: ..., tipo: ... }
    res.json({ ok: true });
});
```

---

## Relação com o banco (MWB)

```
usuarios (id_usuario PK, nome_usuario, senha [bcrypt], ativo, tipo)
    └── dados_usuarios (id_usuario FK, email UNIQUE, nome_completo,
                        data_nascimento, telefone, documento,
                        recebe_promo, recebe_notificacao)
```

No **cadastro**, o backend insere em ambas as tabelas numa única transação.  
No **login**, faz JOIN entre as duas tabelas para localizar o usuário pelo e-mail.

---

## Variáveis de ambiente (`.env`)

| Variável | Padrão | Descrição |
|---------|--------|-----------|
| `PORT` | `3001` | Porta do servidor |
| `DB_HOST` | `localhost` | Host MySQL |
| `DB_PORT` | `3306` | Porta MySQL |
| `DB_USER` | `root` | Usuário MySQL |
| `DB_PASS` | *(vazio)* | Senha MySQL |
| `DB_NAME` | `db_livraria1` | Banco de dados |
| `JWT_SECRET` | *(fraco)* | **Troque por string aleatória longa!** |
| `JWT_EXPIRES_IN` | `7d` | Validade do token |
| `GOOGLE_CLIENT_ID` | *(do projeto)* | Client ID do Google Cloud Console |
| `CORS_ORIGIN` | `*` | Origens permitidas (restrinja em produção) |
