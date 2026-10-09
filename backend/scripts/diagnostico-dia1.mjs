/**
 * Evidencias da base do Dia 1, NAO testes de correcao.
 * Executar: node scripts/diagnostico-dia1.mjs
 * UI isolada: node scripts/diagnostico-dia1.mjs --servir
 * Usa banco temporario, dados ficticios e ERP HTTP em loopback.
 * As assercoes de bugs devem ser revistas ao implementar as correcoes.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const temporario = fs.mkdtempSync(path.join(os.tmpdir(), 'kaizen-dia1-'));
process.env.NODE_ENV = 'test';
process.env.DOTENV_CONFIG_QUIET = 'true';
process.env.DB_PATH = path.join(temporario, 'diagnostico.db');
process.env.JWT_SEGREDO = crypto.randomBytes(48).toString('hex');
process.env.SIAC_TOKEN = 'credencial-ficticia-somente-loopback';

// Mesmo uma configuracao local incorreta nao pode enviar pedidos ao SIAC real.
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (url, opcoes) => {
  assert.equal(new URL(url).hostname, '127.0.0.1', 'Diagnostico permite somente loopback');
  return fetchOriginal(url, opcoes);
};

const produtos = new Map([
  ['RAD', { descricao: 'Radiador de teste', preco_unitario: 684, estoque: 0 }],
  ['FIL', { descricao: 'Filtro de teste', preco_unitario: 10, estoque: 200 }],
  ['SUS', { descricao: 'Amortecedor de teste', preco_unitario: 20, estoque: 200 }],
].map(([codigo, p]) => [codigo, {
  codigo, ativo: true, marca: 'TESTE', categoria: 'TESTE', unidade: 'UN',
  imagem_url: '/imagens/generico.svg', ...p,
}]));
const pedidos = [];
let barreira = null;
let recusarPedido = false;
let catalogoInvalido = false;
const responder = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/health') return responder(res, 200, { status: 'ok' });
  if (url.pathname.startsWith('/imagens/')) {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#00a5ac"/></svg>');
  }
  if (url.pathname === '/produtos/categorias') return responder(res, 200, { dados: ['TESTE'] });
  if (url.pathname === '/produtos') {
    if (catalogoInvalido) { res.writeHead(200); return res.end('nao-json'); }
    const todos = [...produtos.values()].filter(p => p.descricao.toLowerCase().includes((url.searchParams.get('busca') || '').toLowerCase()));
    const pagina = Number(url.searchParams.get('pagina') || 1);
    const tamanho = Number(url.searchParams.get('tamanho') || 24);
    return responder(res, 200, { dados: todos.slice((pagina - 1) * tamanho, pagina * tamanho), paginacao: { pagina, tamanho, total: todos.length, total_paginas: Math.ceil(todos.length / tamanho) } });
  }
  if (url.pathname.startsWith('/produtos/')) {
    const codigo = decodeURIComponent(url.pathname.split('/').pop());
    if (codigo.startsWith('ERRO-')) {
      return responder(res, Number(codigo.slice(5)), { erro: { codigo: 'ERRO_SIMULADO', mensagem: 'Falha simulada' } });
    }
    const produto = produtos.get(codigo);
    return responder(res, produto ? 200 : 404, produto ? { dados: produto } : { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Ausente' } });
  }
  if (url.pathname === '/pedidos' && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    if (recusarPedido) return responder(res, 409, { erro: { codigo: 'ESTOQUE_INSUFICIENTE', mensagem: 'Estoque mudou no ERP' } });
    const payload = JSON.parse(raw);
    const itens = payload.itens.map(i => ({ ...i, descricao: produtos.get(i.codigo_produto).descricao, preco_unitario: produtos.get(i.codigo_produto).preco_unitario, valor_total: produtos.get(i.codigo_produto).preco_unitario * i.quantidade }));
    const pedido = { ...payload, itens, numero: `MOCK-${pedidos.length + 1}`, valor_total: itens.reduce((s, i) => s + i.valor_total, 0), criado_em: new Date().toISOString(), situacao: 'ABERTO', quantidade_itens: itens.length };
    pedidos.push(pedido);
    console.log(`ERP simulado recebeu ${pedido.numero}: ${payload.observacao}`);
    if (barreira) await barreira;
    return responder(res, 201, { dados: pedido });
  }
  if (url.pathname.startsWith('/pedidos/')) return responder(res, 200, { dados: pedidos.find(p => p.numero === url.pathname.split('/').pop()) });
  responder(res, 404, {});
});
mock.listen(0, '127.0.0.1');
await once(mock, 'listening');
process.env.SIAC_URL = `http://127.0.0.1:${mock.address().port}`;
const { config, validarConfig } = await import('../src/config.js');
const { obterBanco, aplicarSchema, fecharBanco } = await import('../src/db/index.js');
const usuarioService = await import('../src/services/usuarioService.js');
const enderecoService = await import('../src/services/enderecoService.js');
const carrinhoService = await import('../src/services/carrinhoService.js');
const pedidoService = await import('../src/services/pedidoService.js');
const erp = await import('../src/erp/cliente.js');
const { paraCentavos } = await import('../src/lib/dinheiro.js');
const { criarApp } = await import('../src/app.js');
validarConfig();
const db = obterBanco();
aplicarSchema(db);
const senhaFicticia = 'TesteLocal123';
const conta = nome => ({ nome: `Pessoa teste ${nome}`, email: `${nome}@example.test`, senha: senhaFicticia, documento: '00000000000', telefone: '11999999999' });
const a = await usuarioService.cadastrarUsuario(conta('a'));
const b = await usuarioService.cadastrarUsuario(conta('b'));
const endereco = (apelido, principal = false) => ({ apelido, cep: '01000-000', logradouro: `Rua de teste ${apelido}`, numero: '10', complemento: null, bairro: 'Centro', cidade: 'Sao Paulo', uf: 'SP', principal });
const casa = enderecoService.criarEndereco(a.id, endereco('Casa', true));
const oficina = enderecoService.criarEndereco(a.id, endereco('Oficina'));
const enderecoB = enderecoService.criarEndereco(b.id, endereco('Pessoa B'));
const semear = itens => {
  carrinhoService.limparCarrinho(a.id);
  for (const [codigo, quantidade] of itens) db.prepare('INSERT INTO carrinho_itens(usuario_id,codigo_produto,quantidade,adicionado_em) VALUES(?,?,?,?)').run(a.id, codigo, quantidade, new Date().toISOString());
};
const servidor = criarApp().listen(process.argv.includes('--servir') ? 3002 : 0, '127.0.0.1');
await once(servidor, 'listening');
const base = `http://127.0.0.1:${servidor.address().port}`;
const chamada = async (rota, { metodo = 'GET', corpo, cookie, headers = {} } = {}) => {
  const res = await fetch(`${base}${rota}`, { method: metodo, headers: { ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) };
};
if (process.argv.includes('--servir')) {
  semear([['FIL', 3], ['SUS', 4]]);
  const { createServer } = await import('../../frontend/node_modules/vite/dist/node/index.js');
  const vite = await createServer({ root: path.resolve(import.meta.dirname, '../../frontend'), server: { host: '127.0.0.1', port: 5174, strictPort: true, proxy: { '/api': { target: base, changeOrigin: true } } } });
  await vite.listen();
  console.log('UI ISOLADA http://127.0.0.1:5174 — contas ficticias a@example.test e b@example.test; senha de fixture: TesteLocal123');
  console.log('Somente ERP simulado. Conta A: Casa principal, Oficina secundaria; FIL 3 + SUS 4.');
  // Os processos sao encerrados por Ctrl+C; o banco temporario nao e o de desenvolvimento.
} else {
  let verificacoes = 0;
  const prova = (id, evidencia) => { verificacoes++; console.log(`EVIDENCIA ${id}: ${evidencia}`); };
  try {
    const segredoAtual = config.jwt.segredo;
    const tokenAtual = config.erp.token;
    config.jwt.segredo = ''; config.erp.token = '';
    assert.throws(validarConfig, /Configuracao invalida/);
    config.jwt.segredo = segredoAtual; config.erp.token = tokenAtual;
    prova('CONFIG', 'ausencia de segredos impede inicializacao');
    assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
    assert.deepEqual(db.pragma('foreign_key_check'), []);
    prova('BANCO', 'integridade e chaves estrangeiras validas no banco de teste');
    semear([['RAD', 1], ['FIL', 3], ['SUS', 4]]);
    let c = await carrinhoService.lerCarrinho(a.id);
    assert.equal(c.valor_total, 794);
    assert.equal(c.itens.filter(i => i.disponivel).reduce((s, i) => s + i.valor_total, 0), 110);
    assert.equal(c.pronto_para_checkout, false);
    await assert.rejects(pedidoService.finalizarPedido(a, casa.id, ''), e => e.codigo === 'CARRINHO_COM_PENDENCIAS');
    assert.equal(pedidos.length, 0);
    prova('KZN-312', 'total 794; itens disponiveis 110; radiador sem estoque adiciona 684; checkout bloqueado');
    semear([['FIL', 3], ['SUS', 4]]);
    c = await carrinhoService.lerCarrinho(a.id);
    assert.equal(c.quantidade_pecas, 2);
    assert.equal(c.itens.reduce((s, i) => s + i.quantidade, 0), 7);
    prova('KZN-318', 'quantidade_pecas=2 com 7 unidades');
    const feito = await pedidoService.finalizarPedido(a, oficina.id, 'Entrega ficticia');
    assert.equal(feito.endereco_entrega.id, oficina.id);
    assert.match(pedidos.at(-1).observacao, /Rua de teste Oficina/);
    const snapshot = JSON.parse(db.prepare('SELECT endereco_entrega FROM pedidos_usuario WHERE numero_erp=?').get(feito.numero).endereco_entrega);
    assert.equal(snapshot.id, oficina.id);
    prova('KZN-331-BACKEND', 'backend respeita id da Oficina no snapshot e na observacao do ERP mock; selecao incorreta deve ser reproduzida na UI');
    assert.equal(paraCentavos(1.15), 114);
    prova('MONETARIO', '1.15 convertido para 114 centavos por Math.floor');
    const loginA = await chamada('/api/auth/login', { metodo: 'POST', corpo: { email: a.email, senha: senhaFicticia } });
    assert.equal(loginA.status, 200);
    const cookieA = loginA.headers.get('set-cookie').split(';')[0];
    const loginB = await chamada('/api/auth/login', { metodo: 'POST', corpo: { email: b.email, senha: senhaFicticia } });
    const cookieB = loginB.headers.get('set-cookie').split(';')[0];
    assert.equal((await chamada('/api/perfil')).status, 401);
    assert.equal((await chamada(`/api/enderecos/${enderecoB.id}`, { metodo: 'PUT', cookie: cookieA, corpo: endereco('Invasao') })).status, 404);
    assert.equal((await chamada(`/api/pedidos/${feito.numero}`, { cookie: cookieB })).status, 404);
    assert.equal((await chamada('/api/pedidos', { metodo: 'POST', cookie: cookieB, corpo: { endereco_id: oficina.id } })).status, 422);
    assert.deepEqual((await chamada('/api/carrinho', { cookie: cookieB })).json.dados.itens, []);
    prova('ISOLAMENTO', 'rotas privadas 401 sem sessao; endereco/pedido alheio 404; checkout com endereco alheio 422; carrinho B vazio');
    const cors = await chamada('/api/perfil', { cookie: cookieA, headers: { Origin: 'https://origem-nao-permitida.example' } });
    assert.equal(cors.headers.get('access-control-allow-origin'), 'https://origem-nao-permitida.example');
    assert.equal(cors.headers.get('access-control-allow-credentials'), 'true');
    prova('CORS', 'origem arbitraria refletida com credentials=true; exploracao no navegador depende de SameSite/origem');
    const perfil = await chamada('/api/perfil', { metodo: 'PATCH', cookie: cookieA, corpo: { nome: a.nome, documento: a.documento, telefone: '' } });
    assert.equal(perfil.json.dados.telefone, '11999999999');
    prova('TELEFONE', 'limpar telefone conserva o valor antigo');
    enderecoService.atualizarEndereco(a.id, casa.id, { principal: false });
    assert.equal(enderecoService.listarEnderecos(a.id).filter(e => e.principal).length, 0);
    prova('ENDERECO-PRINCIPAL', 'desmarcar unico principal deixa conta sem padrao');
    const espacos = await usuarioService.cadastrarUsuario({ ...conta('espacos'), senha: ' TesteLocal123 ' });
    assert.equal((await chamada('/api/auth/login', { metodo: 'POST', corpo: { email: espacos.email, senha: ' TesteLocal123 ' } })).status, 401);
    prova('SENHA-ESPACOS', 'cadastro aceita espacos nas extremidades; login remove e rejeita a mesma senha');
    const troca = await chamada('/api/perfil/senha', { metodo: 'PATCH', cookie: cookieA, corpo: { senha_atual: senhaFicticia, nova_senha: 'OutraSenha123' } });
    assert.equal(troca.status, 200);
    assert.equal((await chamada('/api/perfil', { cookie: cookieA })).status, 200);
    await chamada('/api/auth/logout', { metodo: 'POST', cookie: cookieA });
    assert.equal((await chamada('/api/perfil', { cookie: cookieA })).status, 200);
    prova('SESSAO', 'cookie anterior continua valido apos trocar senha e apos logout (replay via HTTP)');
    semear([['FIL', 1]]);
    assert.equal((await chamada('/api/carrinho/itens/FIL', { metodo: 'PATCH', cookie: cookieA, corpo: { quantidade: true } })).status, 200);
    assert.equal((await chamada('/api/carrinho/itens/FIL', { metodo: 'PATCH', cookie: cookieA, corpo: { quantidade: [2] } })).status, 200);
    prova('VALIDACAO', 'quantidade true e [2] aceitas como 1 e 2 por coercao Number');
    semear([['FIL', 98]]);
    c = await carrinhoService.adicionarItem(a.id, 'FIL', 5);
    assert.equal(c.itens[0].quantidade, 99);
    prova('LIMITE', '98 + 5 aceita silenciosamente apenas 99');
    for (const status of [401, 404, 409, 422, 500]) {
      await assert.rejects(erp.buscarProduto(`ERRO-${status}`), e => e.status === ([401, 500].includes(status) ? 502 : status));
    }
    prova('FALHAS-ERP', '401/500 convertidos para 502; 404/409/422 preservados');
    catalogoInvalido = true;
    const invalido = await chamada('/api/catalogo');
    assert.equal(invalido.status, 200);
    assert.deepEqual(invalido.json.dados, []);
    catalogoInvalido = false;
    prova('ERP-JSON', 'ERP 200 com JSON invalido vira catalogo vazio 200');
    semear([['FIL', 1]]);
    recusarPedido = true;
    await assert.rejects(pedidoService.finalizarPedido(a, oficina.id, ''), e => e.status === 409);
    assert.equal((await carrinhoService.lerCarrinho(a.id)).itens.length, 1);
    recusarPedido = false;
    prova('ESTOQUE-NO-CHECKOUT', '409 do ERP preserva carrinho e nao grava vinculo');
    // Duas finalizacoes leem o mesmo carrinho antes da resposta do ERP.
    let liberar;
    barreira = new Promise(resolve => { liberar = resolve; });
    const antes = pedidos.length;
    const concorrentes = Promise.all([pedidoService.finalizarPedido(a, oficina.id, ''), pedidoService.finalizarPedido(a, oficina.id, '')]);
    for (let n = 0; pedidos.length < antes + 2 && n < 200; n++) await delay(10);
    liberar(); barreira = null;
    await concorrentes;
    assert.equal(pedidos.length, antes + 2);
    prova('PEDIDOS-DUPLICADOS', 'duas finalizacoes simultaneas criam dois pedidos e dois vinculos');
    semear([['FIL', 1]]);
    barreira = new Promise(resolve => { liberar = resolve; });
    const antesMutacao = pedidos.length;
    const pendente = pedidoService.finalizarPedido(a, oficina.id, '');
    for (let n = 0; pedidos.length === antesMutacao && n < 200; n++) await delay(10);
    await carrinhoService.adicionarItem(a.id, 'SUS', 1);
    liberar(); barreira = null;
    await pendente;
    assert.equal(pedidos.at(-1).itens.some(i => i.codigo_produto === 'SUS'), false);
    assert.equal((await carrinhoService.lerCarrinho(a.id)).itens.length, 0);
    prova('MUTACAO-NO-CHECKOUT', 'SUS adicionado durante espera do ERP e apagado sem constar no pedido');
    semear([['FIL', 1]]);
    config.erp.timeoutMs = 30;
    barreira = new Promise(resolve => { liberar = resolve; });
    const antesTimeout = pedidos.length;
    await assert.rejects(pedidoService.finalizarPedido(a, oficina.id, ''), e => e.codigo === 'ERP_INDISPONIVEL');
    liberar(); barreira = null;
    config.erp.timeoutMs = 8000;
    assert.equal(pedidos.length, antesTimeout + 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pedidos_usuario WHERE numero_erp=?').get(pedidos.at(-1).numero).n, 0);
    assert.equal((await carrinhoService.lerCarrinho(a.id)).itens.length, 1);
    prova('TIMEOUT-POS-ACEITE', 'mock aceita pedido antes do timeout; loja nao tem vinculo e conserva carrinho');
    console.log(`CONCLUIDO: ${verificacoes} grupos de evidencias; nenhum pedido enviado ao ERP real.`);
  } finally {
    servidor.closeAllConnections(); mock.closeAllConnections();
    await Promise.all([new Promise(r => servidor.close(r)), new Promise(r => mock.close(r))]);
    fecharBanco();
    // Apenas o diretorio temporario criado por este processo e descartado.
    assert.equal(path.dirname(temporario), os.tmpdir());
    assert.ok(path.basename(temporario).startsWith('kaizen-dia1-'));
    fs.rmSync(temporario, { recursive: true });
  }
}
