import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';

export async function prepararAmbiente() {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'kaizen-regressao-'));
  Object.assign(process.env, {
    NODE_ENV: 'test', DOTENV_CONFIG_QUIET: 'true', DB_PATH: path.join(diretorio, 'loja.db'),
    JWT_SEGREDO: crypto.randomBytes(48).toString('hex'), SIAC_TOKEN: 'somente-mock',
    ERP_TIMEOUT_MS: '250',
  });
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = (url, opcoes) => {
    assert.equal(new URL(url).hostname, '127.0.0.1', 'Teste permite somente loopback');
    return fetchOriginal(url, opcoes);
  };
  const produtos = new Map([
    ['RAD', { descricao: 'Radiador', preco_unitario: 684, estoque: 0 }],
    ['FIL', { descricao: 'Filtro', preco_unitario: 10, estoque: 200 }],
    ['SUS', { descricao: 'Amortecedor', preco_unitario: 20, estoque: 200 }],
  ].map(([codigo, p]) => [codigo, {
    codigo, ativo: true, marca: 'TESTE', categoria: 'TESTE', unidade: 'UN', imagem_url: '/imagens/peca.svg', ...p,
  }]));
  const pedidos = [];
  const controle = { recusar: false, barreira: null, produtoBarreira: null, pedidoInvalido: false, respostas: new Map() };
  const responder = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const mock = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const alternativa = controle.respostas.get(`${req.method} ${url.pathname}`);
    if (alternativa) {
      if (alternativa.atraso) await new Promise(r => setTimeout(r, alternativa.atraso));
      res.writeHead(alternativa.status ?? 200, { 'Content-Type': alternativa.tipo ?? 'application/json' });
      if (alternativa.interromper) {
        res.write('<svg>');
        return setTimeout(() => res.destroy(), 30);
      }
      return res.end(alternativa.raw ?? JSON.stringify(alternativa.json));
    }
    if (url.pathname === '/health') return responder(res, 200, { status: 'ok' });
    if (url.pathname.startsWith('/imagens/')) {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#00a5ac"/></svg>');
    }
    if (url.pathname === '/produtos/categorias') return responder(res, 200, { dados: ['TESTE', 'FREIOS'] });
    if (url.pathname === '/produtos') {
      const todos = [...produtos.values()].filter(p =>
        p.descricao.toLowerCase().includes((url.searchParams.get('busca') || '').toLowerCase()) &&
        (!url.searchParams.get('categoria') || p.categoria === url.searchParams.get('categoria')) &&
        (url.searchParams.get('somente_disponiveis') !== 'true' || p.estoque > 0));
      const pagina = Number(url.searchParams.get('pagina') || 1);
      const tamanho = Number(url.searchParams.get('tamanho') || 24);
      return responder(res, 200, { dados: todos.slice((pagina - 1) * tamanho, pagina * tamanho),
        paginacao: { pagina, tamanho, total: todos.length, total_paginas: Math.max(1, Math.ceil(todos.length / tamanho)) } });
    }
    if (url.pathname.startsWith('/produtos/')) {
      if (controle.produtoBarreira) await controle.produtoBarreira;
      const codigo = decodeURIComponent(url.pathname.split('/').pop());
      if (codigo === 'ERRO') return responder(res, 503, { erro: { mensagem: 'Falha simulada' } });
      const produto = produtos.get(codigo);
      return responder(res, produto ? 200 : 404, produto ? { dados: produto } : { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Ausente' } });
    }
    if (url.pathname === '/pedidos' && req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      if (controle.recusar) return responder(res, 409, { erro: { codigo: 'ESTOQUE_INSUFICIENTE', mensagem: 'Estoque mudou' } });
      const payload = JSON.parse(raw);
      const itens = payload.itens.map(i => ({ ...i, descricao: produtos.get(i.codigo_produto).descricao,
        preco_unitario: produtos.get(i.codigo_produto).preco_unitario, valor_total: produtos.get(i.codigo_produto).preco_unitario * i.quantidade }));
      const pedido = { ...payload, itens, numero: `MOCK-${pedidos.length + 1}`,
        valor_total: payload.itens.reduce((s, i) => s + produtos.get(i.codigo_produto).preco_unitario * i.quantidade, 0),
        criado_em: new Date().toISOString(), situacao: 'ABERTO', quantidade_itens: payload.itens.length };
      pedidos.push(pedido);
      if (controle.barreira) await controle.barreira;
      return responder(res, 201, controle.pedidoInvalido ? {} : { dados: pedido });
    }
    if (url.pathname.startsWith('/pedidos/')) {
      const pedido = pedidos.find(p => p.numero === url.pathname.split('/').pop());
      return responder(res, pedido ? 200 : 404, pedido ? { dados: pedido } : { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Ausente' } });
    }
    responder(res, 404, {});
  });
  mock.listen(0, '127.0.0.1');
  await once(mock, 'listening');
  process.env.SIAC_URL = `http://127.0.0.1:${mock.address().port}`;
  const { config } = await import('../src/config.js');
  const banco = await import('../src/db/index.js');
  const usuarios = await import('../src/services/usuarioService.js');
  const enderecos = await import('../src/services/enderecoService.js');
  const carrinho = await import('../src/services/carrinhoService.js');
  const pedido = await import('../src/services/pedidoService.js');
  const db = banco.obterBanco();
  banco.aplicarSchema(db);
  const conta = nome => ({ nome: `Pessoa ${nome}`, email: `${nome}@example.test`, senha: 'TesteLocal123', documento: '00000000000', telefone: null });
  const a = await usuarios.cadastrarUsuario(conta('a'));
  const b = await usuarios.cadastrarUsuario(conta('b'));
  const endereco = apelido => ({ apelido, cep: '01000000', logradouro: `Rua ${apelido}`, numero: '10', complemento: null, bairro: 'Centro', cidade: 'Sao Paulo', uf: 'SP' });
  const casa = enderecos.criarEndereco(a.id, endereco('Casa'));
  const oficina = enderecos.criarEndereco(a.id, endereco('Oficina'));
  const enderecoB = enderecos.criarEndereco(b.id, endereco('B'));
  function semear(itens, usuarioId = a.id) {
    carrinho.limparCarrinho(usuarioId, db);
    const multiplos = db.prepare('PRAGMA table_info(carrinho_itens)').all().some(c => c.name === 'carrinho_id');
    const coluna = multiplos ? 'carrinho_id' : 'usuario_id';
    const id = multiplos ? db.prepare('SELECT id FROM carrinhos WHERE usuario_id=? AND ativo=1').get(usuarioId).id : usuarioId;
    for (const [codigo, quantidade] of itens) db.prepare(`INSERT INTO carrinho_itens(${coluna},codigo_produto,quantidade,adicionado_em) VALUES(?,?,?,?)`)
      .run(id, codigo, quantidade, new Date().toISOString());
  }
  const { criarApp } = await import('../src/app.js');
  const servidor = criarApp().listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const base = `http://127.0.0.1:${servidor.address().port}`;
  async function chamada(rota, { metodo = 'GET', corpo, cookie, headers = {} } = {}) {
    const res = await fetch(`${base}/api${rota}`, { method: metodo,
      headers: { ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) };
  }
  async function login(usuario = a) {
    const r = await chamada('/auth/login', { metodo: 'POST', corpo: { email: usuario.email, senha: 'TesteLocal123' } });
    assert.equal(r.status, 200);
    return r.headers.get('set-cookie').split(';')[0];
  }
  async function fechar() {
    servidor.closeAllConnections(); mock.closeAllConnections();
    await Promise.all([new Promise(r => servidor.close(r)), new Promise(r => mock.close(r))]);
    banco.fecharBanco(); globalThis.fetch = fetchOriginal;
    fs.rmSync(diretorio, { recursive: true });
  }
  return { db, config, a, b, casa, oficina, enderecoB, endereco, produtos, pedidos, controle, semear,
    carrinho, pedido, enderecos, base, chamada, login, fechar };
}
