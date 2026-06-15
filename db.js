// ============================================================
//  db.js  –  Pool de conexões MySQL (mysql2/promise)
// ============================================================

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               Number(process.env.DB_PORT) || 3306,
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASS     || '',
    database:           process.env.DB_NAME     || 'db_livraria1',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    timezone:           'Z',        // UTC
    decimalNumbers:     true,
});

// Testa a conexão ao iniciar
pool.getConnection()
    .then(conn => {
        console.log('✅ MySQL conectado com sucesso');
        conn.release();
    })
    .catch(err => {
        console.error('❌ Falha ao conectar ao MySQL:', err.message);
        process.exit(1);
    });

module.exports = pool;
