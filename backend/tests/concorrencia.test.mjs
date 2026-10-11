import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { prepararAmbiente } from '../test-support/ambiente.mjs';
let e, s;
before(async () => { e = await prepararAmbiente(); s = await import('../src/services/carrinhosService.js'); });
after(async () => { await e?.fechar(); });
async function esperar(condicao) {
  for (let i = 0; i < 100; i++) {
    if (condicao()) return;
    await new Promise(r => setTimeout(r, 2));
  }
  throw new Error('Barreira nao alcancada');
}
function bloquear() { let liberar; e.controle.barreira = new Promise(r => { liberar = r; }); return () => { liberar(); e.controle.barreira = null; }; }

test('checkout limpa somente carrinho capturado mesmo se ativo mudar durante HTTP', async () => {
  e.semear([['FIL', 3]]);
  const primeiro = s.obterCarrinhoAtivo(e.a.id);
  const outro = s.criarCarrinho(e.a.id, 'Outro');
  const liberar = bloquear(); const total = e.pedidos.length;
  const fechando = e.pedido.finalizarPedido(e.a, e.oficina.id, '');
  await esperar(() => e.pedidos.length > total);
  assert.equal(e.db.inTransaction, false);
  s.ativarCarrinho(e.a.id, outro.id);
  await e.carrinho.adicionarItem(e.a.id, 'SUS', 2);
  liberar(); const p = await fechando;
  assert.equal(p.endereco_entrega.id, e.oficina.id);
  assert.deepEqual(p.itens.map(i => i.codigo_produto), ['FIL']);
  assert.equal((await e.carrinho.lerCarrinho(e.a.id, e.db, primeiro.id)).itens.length, 0);
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).quantidade_pecas, 2);
});
test('duas conexoes SQLite nao conseguem fechar o mesmo carrinho simultaneamente', async () => {
  e.semear([['FIL', 1]]); const total = e.pedidos.length; const liberar = bloquear();
  const fechando = e.pedido.finalizarPedido(e.a, e.casa.id, '');
  await esperar(() => e.pedidos.length > total);
  const outraConexao = new Database(e.db.name); outraConexao.pragma('foreign_keys = ON');
  await assert.rejects(e.pedido.finalizarPedido(e.a, e.casa.id, '', outraConexao), { codigo: 'CHECKOUT_EM_ANDAMENTO' });
  outraConexao.close(); liberar(); await fechando;
  assert.equal(e.pedidos.length, total + 1);
});
test('incluir, alterar, remover, esvaziar e excluir sao rejeitados durante fechamento', async () => {
  e.semear([['FIL', 2]]); const id = s.obterCarrinhoAtivo(e.a.id).id;
  const total = e.pedidos.length; const liberar = bloquear();
  const fechando = e.pedido.finalizarPedido(e.a, e.casa.id, '');
  await esperar(() => e.pedidos.length > total);
  for (const acao of [() => e.carrinho.adicionarItem(e.a.id, 'SUS', 1), () => e.carrinho.alterarQuantidade(e.a.id, 'FIL', 1), () => e.carrinho.removerItem(e.a.id, 'FIL')]) {
    await assert.rejects(acao, { codigo: 'CHECKOUT_EM_ANDAMENTO' });
  }
  assert.throws(() => e.carrinho.limparCarrinho(e.a.id), { codigo: 'CHECKOUT_EM_ANDAMENTO' });
  assert.throws(() => s.excluirCarrinho(e.a.id, id), { codigo: 'CHECKOUT_EM_ANDAMENTO' });
  liberar(); await fechando;
});
test('adicao iniciada antes da reserva e revalidada ao retornar do ERP', async () => {
  e.semear([['FIL', 1]]);
  let liberarProduto; e.controle.produtoBarreira = new Promise(r => { liberarProduto = r; });
  const adicionando = e.carrinho.adicionarItem(e.a.id, 'SUS', 1);
  // Espera o evento de requisicao GET chegar ao mock, antes de reservar.
  await new Promise(r => setTimeout(r, 20));
  const total = e.pedidos.length; const liberarPedido = bloquear();
  const fechando = e.pedido.finalizarPedido(e.a, e.casa.id, '');
  liberarProduto(); e.controle.produtoBarreira = null;
  await assert.rejects(adicionando, { codigo: 'CHECKOUT_EM_ANDAMENTO' });
  await esperar(() => e.pedidos.length > total);
  liberarPedido(); await fechando;
  assert.deepEqual(e.pedidos.at(-1).itens.map(i => i.codigo_produto), ['FIL']);
});
test('retry com mesma tentativa concluida retorna pedido sem criar outro', async () => {
  e.semear([['FIL', 1]]); const tentativaId = randomUUID();
  const opcoes = { tentativaId, carrinhoId: s.obterCarrinhoAtivo(e.a.id).id };
  const total = e.pedidos.length;
  const feito = await e.pedido.finalizarPedido(e.a, e.casa.id, 'Mesmo', e.db, opcoes);
  const repetido = await e.pedido.finalizarPedido(e.a, e.casa.id, 'Mesmo', e.db, opcoes);
  assert.equal(feito.numero, repetido.numero); assert.equal(e.pedidos.length, total + 1);
  await assert.rejects(e.pedido.finalizarPedido(e.a, e.oficina.id, 'Mesmo', e.db, opcoes), { codigo: 'TENTATIVA_ALTERADA' });
  await assert.rejects(e.pedido.finalizarPedido(e.b, e.casa.id, 'Mesmo', e.db, opcoes), { status: 404 });
});
test('HTTP concorrente rejeita segunda tentativa e nega carrinho alheio', async () => {
  e.semear([['FIL', 1]]); const cookie = await e.login();
  const id = s.obterCarrinhoAtivo(e.a.id).id; const total = e.pedidos.length; const liberar = bloquear();
  const corpo = { endereco_id: e.casa.id, carrinho_id: id, tentativa_id: randomUUID() };
  const primeira = e.chamada('/pedidos', { metodo: 'POST', cookie, corpo });
  await esperar(() => e.pedidos.length > total);
  assert.equal((await e.chamada('/pedidos', { metodo: 'POST', cookie, corpo: { ...corpo, tentativa_id: randomUUID() } })).status, 409);
  liberar(); assert.equal((await primeira).status, 201);
  const alheio = s.obterCarrinhoAtivo(e.b.id).id;
  assert.equal((await e.chamada('/pedidos', { metodo: 'POST', cookie, corpo: { ...corpo, carrinho_id: alheio, tentativa_id: randomUUID() } })).status, 404);
  assert.equal(e.pedidos.length, total + 1);
});
test('recusa de estoque libera bloqueio e preserva os outros carrinhos', async () => {
  e.semear([['FIL', 2]]); e.controle.recusar = true;
  await assert.rejects(e.pedido.finalizarPedido(e.a, e.casa.id, ''), { codigo: 'ESTOQUE_INSUFICIENTE' });
  e.controle.recusar = false;
  const c = await e.carrinho.alterarQuantidade(e.a.id, 'FIL', 1);
  assert.equal(c.quantidade_pecas, 1); assert.equal(c.checkout_estado, null);
});
test('falha local depois do aceite faz rollback do vinculo e limpeza; registra numero para reconciliar', async () => {
  e.semear([['FIL', 1]]);
  e.db.exec("CREATE TRIGGER simular_falha BEFORE INSERT ON pedidos_usuario BEGIN SELECT RAISE(ABORT,'falha local simulada'); END;");
  await assert.rejects(e.pedido.finalizarPedido(e.a, e.casa.id, ''), { codigo: 'CHECKOUT_INCERTO' });
  e.db.exec('DROP TRIGGER simular_falha');
  const tentativa = e.db.prepare("SELECT * FROM checkout_tentativas WHERE estado='INCERTO' ORDER BY criado_em DESC LIMIT 1").get();
  assert.equal(tentativa.numero_erp, e.pedidos.at(-1).numero);
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).quantidade_pecas, 1);
  assert.equal(e.db.prepare('SELECT COUNT(*) n FROM pedidos_usuario WHERE numero_erp=?').get(tentativa.numero_erp).n, 0);
  const outro = s.criarCarrinho(e.a.id, 'Apos falha local'); s.ativarCarrinho(e.a.id, outro.id);
});
test('resposta invalida apos aceite mantem tentativa incerta', async () => {
  e.semear([['FIL', 1]]); e.controle.pedidoInvalido = true;
  await assert.rejects(e.pedido.finalizarPedido(e.a, e.casa.id, ''), { codigo: 'CHECKOUT_INCERTO' });
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).checkout_estado, 'INCERTO');
  e.controle.pedidoInvalido = false;
  const outro = s.criarCarrinho(e.a.id, 'Apos resposta invalida'); s.ativarCarrinho(e.a.id, outro.id);
});
test('timeout apos aceite preserva itens e bloqueia retry, inclusive em outra conexao', async () => {
  e.semear([['FIL', 2]]); const total = e.pedidos.length; const liberar = bloquear();
  await assert.rejects(e.pedido.finalizarPedido(e.a, e.casa.id, ''), { codigo: 'CHECKOUT_INCERTO' });
  liberar(); assert.equal(e.pedidos.length, total + 1);
  const c = await e.carrinho.lerCarrinho(e.a.id);
  assert.equal(c.quantidade_pecas, 2); assert.equal(c.checkout_estado, 'INCERTO');
  const db2 = new Database(e.db.name);
  await assert.rejects(e.pedido.finalizarPedido(e.a, e.casa.id, '', db2), { codigo: 'CHECKOUT_INCERTO' }); db2.close();
  await assert.rejects(e.carrinho.adicionarItem(e.a.id, 'SUS', 1), { codigo: 'CHECKOUT_INCERTO' });
  assert.equal(e.pedidos.length, total + 1);
});
