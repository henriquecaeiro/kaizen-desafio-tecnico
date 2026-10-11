import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { prepararAmbiente } from '../test-support/ambiente.mjs';
const e = await prepararAmbiente();
const erp = await import('../src/erp/cliente.js');
e.semear([['FIL', 1]]);
const criado = await e.pedido.finalizarPedido(e.a, e.casa.id, '');
const cookie = await e.login();
after(e.fechar);
beforeEach(() => e.controle.respostas.clear());
const rotas = [
  ['/catalogo', '/produtos'], ['/catalogo/FIL', '/produtos/FIL'],
  ['/catalogo/categorias', '/produtos/categorias'], [`/pedidos/${criado.numero}`, `/pedidos/${criado.numero}`],
];
const invalido = r => { assert.equal(r.status, 502); assert.equal(r.json.erro.codigo, 'ERP_RESPOSTA_INVALIDA'); };

for (const [rota, upstream] of rotas) {
  for (const [nome, resposta] of [
    ['JSON malformado', { raw: 'nao-json' }], ['corpo vazio', { raw: '' }],
    ['null', { json: null }], ['array na raiz', { json: [] }],
    ['dados ausentes', { json: {} }], ['tipo incorreto', { json: { dados: 'invalido' } }],
    ['campos obrigatorios ausentes', { json: { dados: rota === '/catalogo' || rota.endsWith('categorias') ? [{}] : {} } }],
  ]) test(`${rota}: ${nome} nao se apresenta como sucesso vazio`, async () => {
    e.controle.respostas.set(`GET ${upstream}`, resposta);
    invalido(await e.chamada(rota, { cookie }));
  });
}
test('respostas validas preservam produtos, categorias e detalhe do pedido', async () => {
  for (const [rota] of rotas) assert.equal((await e.chamada(rota, { cookie })).status, 200);
  assert.equal((await erp.buscarProduto('FIL')).preco_unitario, 10);
  assert.equal((await erp.buscarPedido(criado.numero)).itens[0].descricao, 'Filtro');
});
test('paginacao invalida e produto com preco/estoque/ativo invalidos sao rejeitados', async () => {
  e.controle.respostas.set('GET /produtos', { json: { dados: [], paginacao: { pagina: 1, tamanho: 24, total: '0', total_paginas: 1 } } });
  invalido(await e.chamada('/catalogo'));
  for (const modificacao of [{ preco_unitario: '10' }, { preco_unitario: null }, { estoque: -1 }, { estoque: 1.2 }, { ativo: 'false' }, { codigo: 'OUTRO' }]) {
    e.controle.respostas.set('GET /produtos/FIL', { json: { dados: { ...e.produtos.get('FIL'), ...modificacao } } });
    invalido(await e.chamada('/catalogo/FIL'));
  }
});
test('lista legitimamente vazia continua sendo sucesso', async () => {
  const r = await e.chamada('/catalogo?busca=nao-existe');
  assert.equal(r.status, 200); assert.deepEqual(r.json.dados, []);
  e.controle.respostas.set('GET /produtos/categorias', { json: { dados: [] } });
  assert.deepEqual(await erp.listarCategorias(), []);
});
for (const [nome, resposta, codigo] of [
  ['timeout', { atraso: 350, json: {} }, 'ERP_INDISPONIVEL'],
  ['HTTP 5xx', { status: 503, raw: 'invalido' }, 'ERP_INDISPONIVEL'],
  ['HTTP 401', { status: 401, json: { erro: { mensagem: 'recusado' } } }, 'ERP_NAO_AUTORIZADO'],
]) test(`${nome} e erro de integracao, nao ausencia de produtos/pedidos`, async () => {
  for (const [rota, upstream] of rotas) {
    e.controle.respostas.set(`GET ${upstream}`, resposta);
    const r = await e.chamada(rota, { cookie });
    assert.equal(r.status, 502); assert.equal(r.json.erro.codigo, codigo);
  }
});
test('historico informa status indisponivel sem inventar lista vazia nem perder dados locais', async () => {
  e.controle.respostas.set(`GET /pedidos/${criado.numero}`, { raw: 'invalido' });
  const r = await e.chamada('/pedidos', { cookie });
  assert.equal(r.status, 200); assert.equal(r.json.dados.length, 1);
  assert.equal(r.json.dados[0].situacao, 'INDISPONIVEL');
  assert.equal(r.json.dados[0].numero, criado.numero); assert.equal(r.json.dados[0].valor_total, 10);
});
test('carrinho com resposta invalida de produto informa erro, sem virar vazio', async () => {
  e.semear([['FIL', 2]]);
  e.controle.respostas.set('GET /produtos/FIL', { json: { dados: null } });
  invalido(await e.chamada('/carrinho', { cookie }));
  assert.equal(e.db.prepare('SELECT quantidade FROM carrinho_itens').get().quantidade, 2);
});
test('health verifica corpo alem de HTTP 200', async () => {
  for (const resposta of [{ raw: 'invalido' }, { raw: '' }, { json: null }, { json: [] }, { json: {} }]) {
    e.controle.respostas.set('GET /health', resposta);
    assert.equal(await erp.verificarErp(), 'resposta invalida');
  }
  e.controle.respostas.set('GET /health', { status: 503, json: {} }); assert.equal(await erp.verificarErp(), 'http 503');
  e.controle.respostas.set('GET /health', { status: 401, json: {} }); assert.equal(await erp.verificarErp(), 'http 401');
  e.controle.respostas.set('GET /health', { atraso: 350, json: { status: 'ok' } }); assert.equal(await erp.verificarErp(), 'timeout');
  e.controle.respostas.clear(); assert.equal(await erp.verificarErp(), 'ok');
});
test('imagem valida preserva tipo; tipo inesperado e falhas upstream sao erros', async () => {
  const valida = await fetch(`${e.base}/api/imagens/peca.svg`);
  assert.equal(valida.status, 200); assert.match(await valida.text(), /^<svg/);
  assert.match(valida.headers.get('content-security-policy'), /sandbox/);
  for (const [resposta, status, codigo] of [
    [{ json: {} }, 502, 'ERP_RESPOSTA_INVALIDA'],
    [{ tipo: 'image/svg+xml', raw: '' }, 502, 'ERP_RESPOSTA_INVALIDA'],
    [{ status: 503, raw: '' }, 502, 'ERP_INDISPONIVEL'],
    [{ status: 401, raw: '' }, 502, 'ERP_NAO_AUTORIZADO'],
    [{ status: 404, raw: '' }, 404, 'NAO_ENCONTRADO'],
    [{ atraso: 350, tipo: 'image/svg+xml', raw: '<svg/>' }, 502, 'ERP_INDISPONIVEL'],
  ]) {
    e.controle.respostas.set('GET /imagens/peca.svg', resposta);
    const r = await e.chamada('/imagens/peca.svg'); assert.equal(r.status, status); assert.equal(r.json.erro.codigo, codigo);
  }
});
test('stream interrompido encerra conexao sem derrubar backend', async () => {
  e.controle.respostas.set('GET /imagens/peca.svg', { tipo: 'image/svg+xml', interromper: true });
  await assert.rejects(async () => {
    const r = await fetch(`${e.base}/api/imagens/peca.svg`); await r.text();
  });
  assert.equal((await e.chamada('/health')).status, 200);
});
test('logs nao contêm query, cookie, request-id arbitrario ou corpo remoto sensivel', async () => {
  const logs = []; const log = console.log; const error = console.error; const ambiente = e.config.ambiente;
  e.config.ambiente = 'development'; console.log = (...args) => logs.push(args.join(' ')); console.error = (...args) => logs.push(args.join(' '));
  try {
    e.controle.respostas.set('GET /produtos', { status: 503, json: { erro: { mensagem: 'marcador-sensivel-remoto' } } });
    const r = await e.chamada('/catalogo?busca=marcador-sensivel-query', { cookie: 'kaizen_sessao=marcador-sensivel-cookie', headers: { 'X-Request-Id': 'marcador-sensivel-header' } });
    assert.equal(r.status, 502); assert.match(r.headers.get('x-request-id'), /^[a-f0-9-]{36}$/);
    assert.ok(logs.length >= 2); assert.doesNotMatch(logs.join('\n'), /marcador-sensivel/);
  } finally { console.log = log; console.error = error; e.config.ambiente = ambiente; }
});
