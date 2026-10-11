-- Tentativa persistente: protege processos/abas concorrentes e sobrevive a
-- reinicio. Estado incerto exige reconciliacao; expirar o bloqueio pode duplicar
-- um pedido ja aceito pelo SIAC.
CREATE TABLE checkout_tentativas (
  id TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  carrinho_id INTEGER REFERENCES carrinhos(id) ON DELETE SET NULL,
  assinatura TEXT NOT NULL,
  estado TEXT NOT NULL CHECK(estado IN ('VALIDANDO','ENVIANDO','CONCLUIDO','RECUSADO','INCERTO')),
  numero_erp TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_checkout_em_andamento ON checkout_tentativas(carrinho_id)
WHERE estado IN ('VALIDANDO','ENVIANDO','INCERTO');
CREATE INDEX idx_checkout_usuario ON checkout_tentativas(usuario_id);
