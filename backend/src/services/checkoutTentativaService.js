import { createHash, randomUUID } from 'node:crypto';
import { agoraISO } from '../db/index.js';
import { ApiError } from '../lib/ApiError.js';
import { conferirAtivo, exigirCarrinhoEditavel } from './carrinhosService.js';

export function iniciarTentativa(usuarioId, enderecoId, observacao, opcoes, db) {
  const id = opcoes.tentativaId ?? randomUUID();
  const assinatura = createHash('sha256')
    .update(
      JSON.stringify({
        enderecoId,
        observacao: observacao || '',
        carrinhoId: opcoes.carrinhoId ?? null,
      }),
    )
    .digest('hex');
  return db
    .transaction(() => {
      const existente = db.prepare('SELECT * FROM checkout_tentativas WHERE id=?').get(id);
      if (existente) {
        if (existente.usuario_id !== usuarioId)
          throw ApiError.naoEncontrado('Tentativa nao encontrada.');
        if (existente.assinatura !== assinatura)
          throw ApiError.conflito(
            'TENTATIVA_ALTERADA',
            'Use uma nova tentativa para alterar os dados do pedido.',
          );
        if (existente.estado === 'CONCLUIDO') return existente;
        if (existente.estado === 'RECUSADO')
          throw ApiError.conflito(
            'TENTATIVA_RECUSADA',
            'O pedido anterior foi recusado. Corrija os dados e confirme novamente.',
          );
        exigirCarrinhoEditavel(existente.carrinho_id, db);
      }
      const carrinho = conferirAtivo(usuarioId, opcoes.carrinhoId, db);
      exigirCarrinhoEditavel(carrinho.id, db);
      const agora = agoraISO();
      db.prepare(
        `INSERT INTO checkout_tentativas(id,usuario_id,carrinho_id,assinatura,estado,criado_em,atualizado_em)
      VALUES(?,?,?,?,'VALIDANDO',?,?)`,
      ).run(id, usuarioId, carrinho.id, assinatura, agora, agora);
      return db.prepare('SELECT * FROM checkout_tentativas WHERE id=?').get(id);
    })
    .immediate();
}

export function atualizarTentativa(id, estado, db, numero = null) {
  db.prepare(
    'UPDATE checkout_tentativas SET estado=?,numero_erp=COALESCE(?,numero_erp),atualizado_em=? WHERE id=?',
  ).run(estado, numero, agoraISO(), id);
}
