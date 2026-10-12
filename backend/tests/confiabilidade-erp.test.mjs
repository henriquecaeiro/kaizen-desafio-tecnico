import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { prepararAmbiente } from '../test-support/ambiente.mjs';
const e = await prepararAmbiente();
const erp = await import('../src/erp/cliente.js');
const cookie = await e.login();
after(e.fechar);
beforeEach(() => { e.controle.respostas.clear(); e.semear([['FIL', 2]]); });

for (const status of [401, 429, 502, 503, 504]) test(`ERP HTTP ${status}: preserva carrinho e recupera após erro`, async () => {
  e.controle.respostas.set('GET /produtos/FIL', { status, json: {} });
  const r = await e.chamada('/carrinho', { cookie });
  assert.equal(r.status, 502);
  assert.equal(r.json.erro.codigo, status === 401 ? 'ERP_NAO_AUTORIZADO' : 'ERP_INDISPONIVEL');
  assert.equal(e.db.prepare('SELECT quantidade FROM carrinho_itens').get().quantidade, 2);
  e.controle.respostas.clear();
  assert.equal((await e.chamada('/carrinho', { cookie })).json.dados.quantidade_pecas, 2);
});
test('ERP lento dentro do timeout funciona; timeout mantém itens e permite nova leitura', async () => {
  e.controle.respostas.set('GET /produtos/FIL', { atraso: 70, json: { dados: e.produtos.get('FIL') } });
  assert.equal((await e.chamada('/carrinho', { cookie })).status, 200);
  e.controle.respostas.set('GET /produtos/FIL', { atraso: 350, json: { dados: e.produtos.get('FIL') } });
  const r = await e.chamada('/carrinho', { cookie });
  assert.equal(r.status, 502); assert.equal(r.json.erro.codigo, 'ERP_INDISPONIVEL');
  assert.equal(e.db.prepare('SELECT quantidade FROM carrinho_itens').get().quantidade, 2);
  e.controle.respostas.clear(); assert.equal((await e.chamada('/carrinho', { cookie })).status, 200);
});
test('consultas simultâneas do mesmo produto compartilham HTTP sem guardar cache', async () => {
  const fetchAnterior = globalThis.fetch; let chamadas = 0;
  globalThis.fetch = (url, opcoes) => {
    if (new URL(url).pathname === '/produtos/FIL') chamadas++;
    return fetchAnterior(url, opcoes);
  };
  e.controle.respostas.set('GET /produtos/FIL', { atraso: 50, json: { dados: e.produtos.get('FIL') } });
  try {
    const produtos = await Promise.all(Array.from({ length: 10 }, () => erp.buscarProduto('FIL')));
    assert.equal(chamadas, 1); assert.ok(produtos.every(p => p.codigo === 'FIL'));
    await erp.buscarProduto('FIL'); assert.equal(chamadas, 2);
    e.controle.respostas.set('GET /produtos/FIL', { status: 503, json: {} });
    await assert.rejects(erp.buscarProduto('FIL'));
    e.controle.respostas.clear(); assert.equal((await erp.buscarProduto('FIL')).codigo, 'FIL');
  } finally { globalThis.fetch = fetchAnterior; }
});
test('enriquecimento de carrinho limita consultas simultâneas a seis', async () => {
  const itens = [];
  for (let i = 0; i < 15; i++) {
    const codigo = `LIM-${i}`; itens.push([codigo, 1]);
    e.produtos.set(codigo, { ...e.produtos.get('FIL'), codigo });
    e.controle.respostas.set(`GET /produtos/${codigo}`, { atraso: 30, json: { dados: e.produtos.get(codigo) } });
  }
  e.semear(itens); const fetchAnterior = globalThis.fetch; let atuais = 0, maximo = 0;
  globalThis.fetch = async (url, opcoes) => {
    if (!new URL(url).pathname.startsWith('/produtos/LIM-')) return fetchAnterior(url, opcoes);
    maximo = Math.max(maximo, ++atuais);
    try { return await fetchAnterior(url, opcoes); } finally { atuais--; }
  };
  try { assert.equal((await e.carrinho.lerCarrinho(e.a.id)).itens.length, 15); assert.ok(maximo <= 6); }
  finally { globalThis.fetch = fetchAnterior; }
});
