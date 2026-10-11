import { obterBanco, agoraISO } from '../db/index.js';
import { ApiError } from '../lib/ApiError.js';

export const MAXIMO_CARRINHOS = 10;

export function exigirCarrinhoEditavel(carrinhoId, db) {
  const tentativa = db.prepare(`SELECT estado FROM checkout_tentativas WHERE carrinho_id=?
    AND estado IN ('VALIDANDO','ENVIANDO','INCERTO')`).get(carrinhoId);
  if (tentativa) throw ApiError.conflito(
    tentativa.estado === 'INCERTO' ? 'CHECKOUT_INCERTO' : 'CHECKOUT_EM_ANDAMENTO',
    tentativa.estado === 'INCERTO'
      ? 'O resultado do pedido precisa ser conferido pela loja. O carrinho foi preservado; nao repita a compra.'
      : 'Este carrinho esta fechando um pedido. Aguarde a conclusao antes de altera-lo.',
  );
}

export function exigirCarrinho(usuarioId, id, db = obterBanco()) {
  const carrinho = db.prepare('SELECT * FROM carrinhos WHERE id=? AND usuario_id=?').get(id, usuarioId);
  if (!carrinho) throw ApiError.naoEncontrado('Carrinho nao encontrado.');
  return carrinho;
}

export function obterCarrinhoAtivo(usuarioId, db = obterBanco()) {
  return db.transaction(() => {
    const ativo = db.prepare('SELECT * FROM carrinhos WHERE usuario_id=? AND ativo=1').get(usuarioId);
    if (ativo) return ativo;
    const primeiro = db.prepare('SELECT * FROM carrinhos WHERE usuario_id=? ORDER BY id LIMIT 1').get(usuarioId);
    if (primeiro) {
      db.prepare('UPDATE carrinhos SET ativo=1,atualizado_em=? WHERE id=?').run(agoraISO(), primeiro.id);
      return { ...primeiro, ativo: 1 };
    }
    const agora = agoraISO();
    const resultado = db.prepare('INSERT INTO carrinhos(usuario_id,nome,ativo,criado_em,atualizado_em) VALUES(?,?,1,?,?)')
      .run(usuarioId, 'Carrinho principal', agora, agora);
    return exigirCarrinho(usuarioId, Number(resultado.lastInsertRowid), db);
  }).immediate();
}

export function conferirAtivo(usuarioId, esperadoId, db = obterBanco()) {
  const ativo = obterCarrinhoAtivo(usuarioId, db);
  if (esperadoId !== undefined && esperadoId !== null) {
    exigirCarrinho(usuarioId, esperadoId, db);
    if (ativo.id !== esperadoId) throw ApiError.conflito('CARRINHO_ALTERADO', 'O carrinho ativo mudou. Atualize a tela antes de continuar.');
  }
  return ativo;
}

export function listarCarrinhos(usuarioId, db = obterBanco()) {
  obterCarrinhoAtivo(usuarioId, db);
  return db.prepare(`SELECT c.*,COALESCE(SUM(i.quantidade),0) quantidade_pecas,
    COUNT(i.id) quantidade_itens FROM carrinhos c LEFT JOIN carrinho_itens i ON i.carrinho_id=c.id
    WHERE c.usuario_id=? GROUP BY c.id ORDER BY c.id`).all(usuarioId)
    .map(c => ({ ...c, ativo: c.ativo === 1 }));
}

export function criarCarrinho(usuarioId, nome, db = obterBanco()) {
  return db.transaction(() => {
    obterCarrinhoAtivo(usuarioId, db);
    const { total } = db.prepare('SELECT COUNT(*) total FROM carrinhos WHERE usuario_id=?').get(usuarioId);
    if (total >= MAXIMO_CARRINHOS) throw ApiError.conflito('LIMITE_CARRINHOS', 'Voce pode manter no maximo 10 carrinhos.');
    const agora = agoraISO();
    const resultado = db.prepare('INSERT INTO carrinhos(usuario_id,nome,criado_em,atualizado_em) VALUES(?,?,?,?)').run(usuarioId, nome, agora, agora);
    return { ...exigirCarrinho(usuarioId, Number(resultado.lastInsertRowid), db), ativo: false };
  }).immediate();
}

export function renomearCarrinho(usuarioId, id, nome, db = obterBanco()) {
  exigirCarrinho(usuarioId, id, db);
  db.prepare('UPDATE carrinhos SET nome=?,atualizado_em=? WHERE id=? AND usuario_id=?').run(nome, agoraISO(), id, usuarioId);
  const carrinho = exigirCarrinho(usuarioId, id, db);
  return { ...carrinho, ativo: carrinho.ativo === 1 };
}

export function ativarCarrinho(usuarioId, id, db = obterBanco()) {
  return db.transaction(() => {
    exigirCarrinho(usuarioId, id, db);
    db.prepare('UPDATE carrinhos SET ativo=0 WHERE usuario_id=? AND ativo=1').run(usuarioId);
    db.prepare('UPDATE carrinhos SET ativo=1,atualizado_em=? WHERE id=? AND usuario_id=?').run(agoraISO(), id, usuarioId);
    return { ...exigirCarrinho(usuarioId, id, db), ativo: true };
  }).immediate();
}

export function excluirCarrinho(usuarioId, id, db = obterBanco()) {
  db.transaction(() => {
    const alvo = exigirCarrinho(usuarioId, id, db);
    exigirCarrinhoEditavel(alvo.id, db);
    db.prepare('DELETE FROM carrinhos WHERE id=? AND usuario_id=?').run(alvo.id, usuarioId);
    // Excluir o ultimo recria um padrao vazio; excluir o ativo promove o mais antigo.
    obterCarrinhoAtivo(usuarioId, db);
  }).immediate();
}
