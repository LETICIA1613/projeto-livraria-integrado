-- ============================================================
--  migrations/001_auth_tables.sql
--  Garante que as tabelas de autenticação existam e estejam
--  alinhadas com o modelo MWB.
--
--  Execute: mysql -u root -p db_livraria1 < migrations/001_auth_tables.sql
-- ============================================================

-- Cria o banco se ainda não existir
CREATE DATABASE IF NOT EXISTS db_livraria1
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE db_livraria1;

-- ------------------------------------------------------------
--  usuarios  –  credenciais de acesso
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nome_usuario VARCHAR(45)  NOT NULL UNIQUE,
    senha        VARCHAR(255) NOT NULL,          -- bcrypt hash
    ativo        TINYINT(1)   NOT NULL DEFAULT 1,
    tipo         ENUM('cliente','vendedor','administrador') NOT NULL DEFAULT 'cliente',
    PRIMARY KEY (id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
--  dados_usuarios  –  perfil pessoal do cliente
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dados_usuarios (
    id_dados_usuario  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario        INT UNSIGNED NOT NULL,
    nome_completo     VARCHAR(120),
    telefone          VARCHAR(15),
    email             VARCHAR(120) NOT NULL UNIQUE,
    data_nascimento   VARCHAR(10),               -- formato YYYY-MM-DD
    documento         VARCHAR(25),
    recebe_promo      TINYINT(1) NOT NULL DEFAULT 0,
    recebe_notificacao TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id_dados_usuario),
    CONSTRAINT fk_du_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
