import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararAmbiente } from '../test-support/ambiente.mjs';
let e;
before(async () => { e = await prepararAmbiente(); });
after(async () => { await e?.fechar(); });

for (const nome of ['casa', 'oficina']) test(`checkout respeita endereco ${nome} e observacao`, async () => {
  e.semear([['FIL', 3]]);
  const p = await e.pedido.finalizarPedido(e.a, e[nome].id, 'Portao lateral');
  assert.equal(p.endereco_entrega.id, e[nome].id);
  assert.match(e.pedidos.at(-1).observacao, new RegExp(`Rua ${e[nome].apelido}`));
  assert.match(e.pedidos.at(-1).observacao, /Portao lateral/);
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).itens.length, 0);
  const snapshot = JSON.parse(e.db.prepare('SELECT endereco_entrega FROM pedidos_usuario WHERE numero_erp=?').get(p.numero).endereco_entrega);
  assert.equal(snapshot.id, e[nome].id);
});
test('usuario com endereco unico e endereco recem-criado', async () => {
  e.semear([['FIL', 1]], e.b.id);
  const unico = await e.pedido.finalizarPedido(e.b, e.enderecoB.id, '');
  assert.equal(unico.endereco_entrega.id, e.enderecoB.id);
  const novo = e.enderecos.criarEndereco(e.a.id, e.endereco('Novo'));
  e.semear([['FIL', 1]]);
  const p = await e.pedido.finalizarPedido(e.a, novo.id, '');
  assert.equal(p.endereco_entrega.id, novo.id);
});
test('endereco excluido ou alheio rejeita checkout e preserva itens', async () => {
  const removido = e.enderecos.criarEndereco(e.a.id, e.endereco('Removido'));
  e.enderecos.removerEndereco(e.a.id, removido.id);
  e.semear([['FIL', 1]]);
  const quantidade = e.pedidos.length;
  for (const id of [removido.id, e.enderecoB.id]) {
    await assert.rejects(e.pedido.finalizarPedido(e.a, id, ''), { status: 422 });
    assert.equal((await e.carrinho.lerCarrinho(e.a.id)).itens.length, 1);
  }
  assert.equal(e.pedidos.length, quantidade);
});
test('editar endereco depois nao altera snapshot do pedido', async () => {
  e.semear([['FIL', 1]]);
  const p = await e.pedido.finalizarPedido(e.a, e.oficina.id, '');
  e.enderecos.atualizarEndereco(e.a.id, e.oficina.id, { logradouro: 'Rua editada' });
  const historico = await e.pedido.buscarPedidoDoUsuario(e.a.id, p.numero);
  assert.equal(historico.endereco_entrega.logradouro, 'Rua Oficina');
});
test('falha de checkout preserva itens e nao grava vinculo', async () => {
  e.semear([['FIL', 2]]); e.controle.recusar = true;
  const total = e.db.prepare('SELECT COUNT(*) AS n FROM pedidos_usuario').get().n;
  await assert.rejects(e.pedido.finalizarPedido(e.a, e.casa.id, ''), { codigo: 'ESTOQUE_INSUFICIENTE' });
  assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM pedidos_usuario').get().n, total);
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).quantidade_pecas, 2);
  e.controle.recusar = false;
});
test('rotas exigem sessao, validam endereco e negam pedido alheio', async () => {
  assert.equal((await e.chamada('/pedidos', { metodo: 'POST', corpo: { endereco_id: e.casa.id } })).status, 401);
  const cookie = await e.login(e.b);
  assert.equal((await e.chamada('/pedidos', { metodo: 'POST', cookie, corpo: { endereco_id: e.oficina.id } })).status, 422);
  assert.equal((await e.chamada(`/pedidos/${e.pedidos[0].numero}`, { cookie })).status, 404);
});
