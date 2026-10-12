import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepararAmbiente } from '../test-support/ambiente.mjs';

// Opcional: CLI oficial instalada fora do projeto. Nunca usa banco/ERP de producao.
if (!process.env.NETLIFY_CLI) throw new Error('Informe NETLIFY_CLI com o caminho do bin/run.js da CLI Netlify instalada.');
const e = await prepararAmbiente();
const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'kaizen-proxy-mock-'));
const processos = [];
async function portaLivre() {
  const servidor = http.createServer().listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const porta = servidor.address().port;
  await new Promise(r => servidor.close(r));
  return porta;
}
async function iniciar(executavel, argumentos, opcoes, pronto) {
  const processo = spawn(executavel, argumentos, { ...opcoes, stdio: ['ignore', 'pipe', 'pipe'] });
  processos.push(processo);
  let saida = '';
  processo.stdout.on('data', dado => { saida += dado; });
  processo.stderr.on('data', dado => { saida += dado; });
  for (let i = 0; !saida.includes(pronto); i++) {
    if (processo.exitCode !== null || i >= 1200) throw new Error('Processo de teste do proxy nao iniciou; nenhum log de credenciais e exibido.');
    await new Promise(r => setTimeout(r, 25));
  }
}
try {
  const portaBackend = await portaLivre();
  const portaProxy = await portaLivre();
  const portaArquivos = await portaLivre();
  await iniciar(process.execPath, ['src/server.js'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(portaBackend),
      CORS_ORIGEM: 'https://proxy-fixture.test', TRUST_PROXY: 'loopback' },
  }, 'Kaizen Autopecas (loja)');
  const dist = path.join(diretorio, 'dist');
  fs.cpSync(fileURLToPath(new URL('../../frontend/dist', import.meta.url)), dist, { recursive: true });
  // Troca apenas a origem na copia temporaria. O dist entregue permanece no ngrok real.
  const redirects = fs.readFileSync(path.join(dist, '_redirects'), 'utf8');
  fs.writeFileSync(path.join(dist, '_redirects'), redirects.replace(/https:\/\/[^/]+(?=\/api\/:splat)/,
    `http://127.0.0.1:${portaBackend}`));
  await iniciar(process.env.NETLIFY_CLI_NODE || process.execPath, [process.env.NETLIFY_CLI,
    'dev', '--framework', '#static', '--dir', dist, '--port', String(portaProxy),
    '--target-port', String(portaArquivos), '--offline', '--no-open', '--skip-gitignore'], { cwd: diretorio, env: process.env },
  'Local dev server ready');
  const base = `http://127.0.0.1:${portaProxy}/api`;
  let cookie, carrinhoEsperado;
  async function chamada(rota, metodo = 'GET', corpo, status = 200) {
    const res = await fetch(base + rota, { method: metodo, redirect: 'manual',
      headers: { Origin: 'https://proxy-fixture.test', 'ngrok-skip-browser-warning': '1',
        ...(carrinhoEsperado ? { 'X-Carrinho-Id': String(carrinhoEsperado) } : {}),
        ...(cookie ? { Cookie: cookie } : {}), ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    assert.equal(res.status, status, `${metodo} ${rota}`);
    assert.equal(res.headers.get('location'), null);
    return { res, json: status === 204 ? null : await res.json() };
  }
  assert.equal((await chamada('/health')).json.erp, 'ok');
  assert.equal((await chamada('/catalogo?busca=Filtro&tamanho=1')).json.dados[0].codigo, 'FIL');
  const login = await chamada('/auth/login', 'POST', { email: e.a.email, senha: 'TesteLocal123' });
  const sessao = login.res.headers.get('set-cookie');
  assert.match(sessao, /HttpOnly/); assert.match(sessao, /Secure/); assert.match(sessao, /SameSite=Lax/);
  assert.doesNotMatch(sessao, /(?:^|;)\s*Domain=/i);
  cookie = sessao.split(';')[0];
  assert.equal((await chamada('/auth/eu')).json.dados.id, e.a.id);
  const carrinho = (await chamada('/carrinhos', 'POST', { nome: 'Proxy mock' }, 201)).json.dados;
  await chamada(`/carrinhos/${carrinho.id}/ativar`, 'PUT');
  carrinhoEsperado = carrinho.id;
  await chamada('/carrinho/itens', 'POST', { codigo_produto: 'FIL', quantidade: 2 }, 201);
  await chamada('/carrinho/itens/FIL', 'PATCH', { quantidade: 4 });
  assert.equal((await chamada('/carrinho')).json.dados.quantidade_pecas, 4);
  const reserva = (await chamada('/carrinhos', 'POST', { nome: 'Reserva mock' }, 201)).json.dados;
  carrinhoEsperado = reserva.id;
  await chamada('/carrinho/itens/FIL', 'PATCH', { quantidade: 5 }, 409);
  carrinhoEsperado = carrinho.id;
  assert.equal((await chamada('/carrinho')).json.dados.quantidade_pecas, 4);
  await chamada('/perfil', 'PATCH', { telefone: '11999998888' });
  assert.equal((await chamada('/perfil')).json.dados.telefone, '11999998888');
  const endereco = (await chamada('/enderecos', 'POST', e.endereco('Proxy'), 201)).json.dados;
  await chamada(`/enderecos/${endereco.id}`, 'PUT', { ...e.endereco('Proxy'), numero: '20' });
  assert.ok((await chamada('/enderecos')).json.dados.some(item => item.id === endereco.id && item.numero === '20'));
  await chamada(`/enderecos/${endereco.id}`, 'DELETE', undefined, 204);
  await chamada('/carrinho/itens/FIL', 'DELETE');
  await chamada('/inexistente', 'GET', undefined, 404);
  e.controle.respostas.set('GET /produtos', { status: 503, json: {} });
  await chamada('/catalogo', 'GET', undefined, 502);
  e.controle.respostas.clear();
  await chamada('/catalogo');
  await chamada('/auth/logout', 'POST');
  await chamada('/auth/eu', 'GET', undefined, 401);
  const loginB = await chamada('/auth/login', 'POST', { email: e.b.email, senha: 'TesteLocal123' });
  cookie = loginB.res.headers.get('set-cookie').split(';')[0];
  assert.notEqual((await chamada('/carrinho')).json.dados.id, carrinho.id);
  await chamada(`/carrinhos/${carrinho.id}/ativar`, 'PUT', undefined, 404);
  assert.equal(e.pedidos.length, 0);
  console.log('Proxy CLI Netlify aprovado com producao mock: GET/POST/PATCH/PUT/DELETE, query/JSON, cookies Secure/HttpOnly/Lax, sessao, perfil, enderecos, carrinhos, isolamento, erros. Zero pedidos.');
} finally {
  for (const processo of processos.reverse()) if (processo.exitCode === null && processo.signalCode === null) {
    processo.kill('SIGTERM'); await once(processo, 'exit');
  }
  await e.fechar();
  fs.rmSync(diretorio, { recursive: true, force: true });
}
