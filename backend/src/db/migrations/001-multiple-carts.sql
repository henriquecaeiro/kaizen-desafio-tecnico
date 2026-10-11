CREATE TABLE carrinhos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL CHECK(length(trim(nome)) BETWEEN 1 AND 80),
  ativo INTEGER NOT NULL DEFAULT 0 CHECK(ativo IN (0, 1)),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
CREATE INDEX idx_carrinhos_usuario ON carrinhos(usuario_id);
CREATE UNIQUE INDEX idx_carrinhos_ativo ON carrinhos(usuario_id) WHERE ativo = 1;

-- Um padrao para cada conta, inclusive quem ainda nao adicionou produtos.
INSERT INTO carrinhos(usuario_id,nome,ativo,criado_em,atualizado_em)
SELECT id,'Carrinho principal',1,criado_em,atualizado_em FROM usuarios;

CREATE TABLE carrinho_itens_novo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  carrinho_id INTEGER NOT NULL REFERENCES carrinhos(id) ON DELETE CASCADE,
  codigo_produto TEXT NOT NULL,
  quantidade INTEGER NOT NULL CHECK(quantidade > 0),
  adicionado_em TEXT NOT NULL,
  UNIQUE(carrinho_id,codigo_produto)
);
-- Preserva ids, codigos, quantidades e datas. Precos continuam somente no SIAC.
INSERT INTO carrinho_itens_novo(id,carrinho_id,codigo_produto,quantidade,adicionado_em)
SELECT i.id,c.id,i.codigo_produto,i.quantidade,i.adicionado_em
FROM carrinho_itens i JOIN carrinhos c ON c.usuario_id=i.usuario_id;
-- Nao aceitar uma migracao que descarte itens orfaos de um banco inconsistente.
CREATE TEMP TABLE verificacao_migracao (ok INTEGER CHECK(ok = 1));
INSERT INTO verificacao_migracao SELECT
  (SELECT COUNT(*) FROM carrinho_itens) = (SELECT COUNT(*) FROM carrinho_itens_novo);
DROP TABLE verificacao_migracao;
DROP TABLE carrinho_itens;
ALTER TABLE carrinho_itens_novo RENAME TO carrinho_itens;
CREATE INDEX idx_itens_carrinho ON carrinho_itens(carrinho_id);
