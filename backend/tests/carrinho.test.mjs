import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararAmbiente } from '../test-support/ambiente.mjs';
let e;
before(async () => { e = await prepararAmbiente(); });
after(async () => { await e?.fechar(); });

test('carrinho vazio tem total zero e nao fecha', async () => {
  e.semear([]);
  const c = await e.carrinho.lerCarrinho(e.a.id);
  assert.equal(c.valor_total, 0); assert.equal(c.pronto_para_checkout, false);
  await assert.rejects(e.pedido.finalizarPedido(e.a, e.casa.id, ''), { codigo: 'CARRINHO_VAZIO' });
});
test('todos disponiveis: quantidades e centavos compoem o total', async () => {
  e.produtos.get('FIL').preco_unitario = 1.15;
  e.produtos.get('SUS').preco_unitario = 19.99;
  e.semear([['FIL', 3], ['SUS', 4]]);
  const c = await e.carrinho.lerCarrinho(e.a.id);
  assert.equal(c.valor_total, 83.41); assert.equal(c.valor_itens, 83.41);
  assert.equal(c.itens[0].valor_total, 3.45); assert.equal(c.pronto_para_checkout, true);
  e.produtos.get('FIL').preco_unitario = 10; e.produtos.get('SUS').preco_unitario = 20;
});
for (const [nome, codigo, alteracoes] of [
  ['sem estoque', 'RAD', {}], ['inativo', 'RAD', { ativo: false, estoque: 10 }],
  ['estoque insuficiente', 'RAD', { ativo: true, estoque: 1 }], ['ausente', 'AUSENTE', null],
]) {
  test(`pendencia ${nome}: preserva linha, exclui do total e bloqueia checkout`, async () => {
    Object.assign(e.produtos.get('RAD'), { ativo: true, estoque: 0 }, alteracoes);
    e.semear([[codigo, 2], ['FIL', 3], ['SUS', 4]]);
    const c = await e.carrinho.lerCarrinho(e.a.id);
    assert.equal(c.itens.length, 3); assert.equal(c.itens[0].quantidade, 2);
    assert.equal(c.valor_total, 110); assert.equal(c.itens[0].valor_elegivel, 0);
    assert.equal(c.valor_itens, codigo === 'AUSENTE' ? 110 : 1478);
    await assert.rejects(e.pedido.finalizarPedido(e.a, e.casa.id, ''), { codigo: 'CARRINHO_COM_PENDENCIAS' });
    assert.equal(e.pedidos.length, 0);
  });
}
test('falha de consulta ERP nao se apresenta como carrinho vazio', async () => {
  e.semear([['ERRO', 1]]);
  await assert.rejects(e.carrinho.lerCarrinho(e.a.id), { codigo: 'ERP_INDISPONIVEL' });
  await assert.rejects(e.pedido.finalizarPedido(e.a, e.casa.id, ''), { codigo: 'ERP_INDISPONIVEL' });
  assert.equal(e.pedidos.length, 0);
});

test('contador distingue produtos de unidades, incluindo pendencias', async () => {
  e.semear([['FIL', 3], ['SUS', 4]]);
  let c = await e.carrinho.lerCarrinho(e.a.id);
  assert.equal(c.quantidade_itens, 2); assert.equal(c.quantidade_pecas, 7);
  c = await e.carrinho.adicionarItem(e.a.id, 'FIL', 2);
  assert.equal(c.quantidade_itens, 2); assert.equal(c.quantidade_pecas, 9);
  c = await e.carrinho.alterarQuantidade(e.a.id, 'FIL', 1);
  assert.equal(c.quantidade_pecas, 5);
  c = await e.carrinho.removerItem(e.a.id, 'SUS');
  assert.equal(c.quantidade_pecas, 1); assert.equal(c.quantidade_itens, 1);
  e.semear([['RAD', 3], ['FIL', 4]]);
  c = await e.carrinho.lerCarrinho(e.a.id);
  assert.equal(c.quantidade_pecas, 7);
  e.carrinho.limparCarrinho(e.a.id);
  c = await e.carrinho.lerCarrinho(e.a.id);
  assert.equal(c.quantidade_pecas, 0); assert.equal(c.quantidade_itens, 0);
});
