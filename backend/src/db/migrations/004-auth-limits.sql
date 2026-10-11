CREATE TABLE autenticacao_limites (
  chave TEXT PRIMARY KEY,
  tentativas INTEGER NOT NULL CHECK(tentativas > 0),
  expira_em INTEGER NOT NULL
);
CREATE INDEX idx_autenticacao_limites_expiracao ON autenticacao_limites(expira_em);
