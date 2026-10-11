import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prepararAmbiente } from '../test-support/ambiente.mjs';
let e, s;
before(async () => { e = await prepararAmbiente(); s = await import('../src/services/carrinhosService.js'); });
after(async () => { await e?.fechar(); });

test('primeiro acesso cria padrao, renomeia e persiste selecao', () => {
  const padrao = s.obterCarrinhoAtivo(e.a.id);
  assert.equal(padrao.nome, 'Carrinho principal');
  assert.equal(s.listarCarrinhos(e.a.id).length, 1);
  const novo = s.criarCarrinho(e.a.id, 'Gol do Joao');
  assert.equal(s.renomearCarrinho(e.a.id, novo.id, 'Civic prata').nome, 'Civic prata');
  s.ativarCarrinho(e.a.id, novo.id);
  assert.equal(s.obterCarrinhoAtivo(e.a.id).id, novo.id);
  assert.equal(s.listarCarrinhos(e.a.id).filter(c => c.ativo).length, 1);
});
test('itens ficam isolados e precos sao consultados novamente no ERP', async () => {
  const primeiro = s.obterCarrinhoAtivo(e.a.id);
  const segundo = s.criarCarrinho(e.a.id, 'Revisao');
  await e.carrinho.adicionarItem(e.a.id, 'FIL', 3);
  s.ativarCarrinho(e.a.id, segundo.id);
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).quantidade_pecas, 0);
  await e.carrinho.adicionarItem(e.a.id, 'SUS', 4);
  await e.carrinho.alterarQuantidade(e.a.id, 'SUS', 2);
  s.ativarCarrinho(e.a.id, primeiro.id);
  e.produtos.get('FIL').preco_unitario = 11.15;
  const c = await e.carrinho.lerCarrinho(e.a.id);
  assert.equal(c.valor_total, 33.45); assert.equal(c.quantidade_pecas, 3);
  assert.equal((await e.carrinho.lerCarrinho(e.a.id, e.db, segundo.id)).quantidade_pecas, 2);
  await e.carrinho.removerItem(e.a.id, 'FIL');
  assert.equal((await e.carrinho.lerCarrinho(e.a.id, e.db, segundo.id)).quantidade_pecas, 2);
  e.produtos.get('FIL').preco_unitario = 10;
});
test('excluir ativo promove outro; excluir ultimo recria padrao vazio', async () => {
  let lista = s.listarCarrinhos(e.a.id);
  const ativo = lista.find(c => c.ativo);
  s.excluirCarrinho(e.a.id, ativo.id);
  assert.equal(s.listarCarrinhos(e.a.id).filter(c => c.ativo).length, 1);
  for (const c of s.listarCarrinhos(e.a.id)) s.excluirCarrinho(e.a.id, c.id);
  lista = s.listarCarrinhos(e.a.id);
  assert.equal(lista.length, 1); assert.equal(lista[0].nome, 'Carrinho principal');
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).itens.length, 0);
});
test('limite de dez carrinhos e protegido em transacao', () => {
  while (s.listarCarrinhos(e.a.id).length < 10) s.criarCarrinho(e.a.id, 'Vazio');
  assert.throws(() => s.criarCarrinho(e.a.id, 'Onze'), { codigo: 'LIMITE_CARRINHOS' });
  assert.equal(s.listarCarrinhos(e.a.id).length, 10);
});
test('servicos negam ids alheios sem revelar dados', async () => {
  const alheio = s.obterCarrinhoAtivo(e.b.id);
  for (const acao of [() => s.exigirCarrinho(e.a.id, alheio.id), () => s.renomearCarrinho(e.a.id, alheio.id, 'Invasao'),
    () => s.excluirCarrinho(e.a.id, alheio.id), () => s.ativarCarrinho(e.a.id, alheio.id)]) assert.throws(acao, { status: 404 });
  await assert.rejects(e.carrinho.lerCarrinho(e.a.id, e.db, alheio.id), { status: 404 });
  await assert.rejects(e.carrinho.adicionarItem(e.a.id, 'FIL', 1, e.db, alheio.id), { status: 404 });
});
test('rotas gerenciam carrinhos e rejeitam nomes, ids e quantidades invalidos', async () => {
  const cookie = await e.login(e.b);
  assert.equal((await e.chamada('/carrinhos')).status, 401);
  const r = await e.chamada('/carrinhos', { metodo: 'POST', cookie, corpo: { nome: ' Oficina ' } });
  assert.equal(r.status, 201); assert.equal(r.json.dados.nome, 'Oficina');
  const id = r.json.dados.id;
  assert.equal((await e.chamada(`/carrinhos/${id}`, { metodo: 'PATCH', cookie, corpo: { nome: 'Civic' } })).status, 200);
  assert.equal((await e.chamada(`/carrinhos/${id}/ativar`, { metodo: 'PUT', cookie })).status, 200);
  for (const nome of ['', ' '.repeat(5), 'a'.repeat(81), true]) assert.equal((await e.chamada('/carrinhos', { metodo: 'POST', cookie, corpo: { nome } })).status, 422);
  assert.equal((await e.chamada('/carrinhos/invalido', { metodo: 'DELETE', cookie })).status, 422);
  for (const quantidade of [true, [2], {}, 0, -1, 1.5, 100]) assert.equal((await e.chamada('/carrinho/itens', { metodo: 'POST', cookie, corpo: { codigo_produto: 'FIL', quantidade } })).status, 422);
  assert.equal((await e.chamada(`/carrinhos/${id}`, { metodo: 'DELETE', cookie })).status, 200);
});
test('API rejeita carrinhos da outra conta em ativacao, alteracao e exclusao', async () => {
  const cookie = await e.login(e.a); const alheio = s.obterCarrinhoAtivo(e.b.id);
  for (const [metodo, rota, corpo] of [['PATCH', `/carrinhos/${alheio.id}`, { nome: 'Invasao' }],
    ['PUT', `/carrinhos/${alheio.id}/ativar`], ['DELETE', `/carrinhos/${alheio.id}`]]) {
    assert.equal((await e.chamada(rota, { metodo, cookie, corpo })).status, 404);
  }
  const lista = (await e.chamada('/carrinhos', { cookie })).json.dados;
  assert.ok(lista.every(c => c.usuario_id === e.a.id));
});
test('acao de aba antiga nao modifica carrinho recem-ativado', async () => {
  const lista = s.listarCarrinhos(e.a.id); const antes = lista.find(c => c.ativo);
  const depois = lista.find(c => !c.ativo); s.ativarCarrinho(e.a.id, depois.id);
  await assert.rejects(e.carrinho.adicionarItem(e.a.id, 'FIL', 1, e.db, antes.id), { codigo: 'CARRINHO_ALTERADO' });
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).itens.length, 0);
});
test('adicao nao satura quantidades silenciosamente', async () => {
  e.semear([['FIL', 98]]);
  await assert.rejects(e.carrinho.adicionarItem(e.a.id, 'FIL', 5), { codigo: 'LIMITE_QUANTIDADE' });
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).quantidade_pecas, 98);
});
