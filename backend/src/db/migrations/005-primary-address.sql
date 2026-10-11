-- Repara apenas a selecao: conserva o principal mais antigo ou promove o
-- primeiro endereco. Conteudo e datas dos enderecos permanecem intactos.
UPDATE enderecos SET principal = CASE WHEN id = COALESCE(
  (SELECT MIN(e.id) FROM enderecos e WHERE e.usuario_id=enderecos.usuario_id AND e.principal=1),
  (SELECT MIN(e.id) FROM enderecos e WHERE e.usuario_id=enderecos.usuario_id)
) THEN 1 ELSE 0 END;
CREATE UNIQUE INDEX idx_enderecos_principal ON enderecos(usuario_id) WHERE principal=1;
