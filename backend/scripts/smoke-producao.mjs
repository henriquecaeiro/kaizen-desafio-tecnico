import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepararAmbiente } from '../test-support/ambiente.mjs';

// Bootstrap real, banco temporario e SIAC mock. Nenhum pedido e enviado.
// Requer frontend/dist atualizado; TLS publico e validado somente no host real.
const e = await prepararAmbiente();
const reserva = http.createServer(); reserva.listen(0, '127.0.0.1'); await once(reserva, 'listening');
const porta = reserva.address().port;
await new Promise(r => reserva.close(r));
const base = `http://127.0.0.1:${porta}`;
let processo;
async function iniciar() {
  processo = spawn(process.execPath, ['src/server.js'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(porta),
      CORS_ORIGEM: 'https://loja.example.test', TRUST_PROXY: 'loopback' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  processo.stdout.on('data', dado => { log += dado; });
  processo.stderr.on('data', dado => { log += dado; });
  for (let i = 0; !log.includes('Kaizen Autopecas (loja)'); i++) {
    if (processo.exitCode !== null || i >= 200) throw new Error('Backend de producao nao iniciou.');
    await new Promise(r => setTimeout(r, 25));
  }
}
async function parar() {
  if (processo && processo.exitCode === null && processo.signalCode === null) {
    processo.kill('SIGTERM'); await once(processo, 'exit');
  }
}
let cookie;
async function chamada(rota, metodo = 'GET', corpo) {
  const res = await fetch(base + rota, { method: metodo,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined });
  assert.ok(res.ok, `Smoke: ${metodo} ${rota} retornou ${res.status}`);
  return { res, json: res.status === 204 ? null : await res.json() };
}
try {
  await iniciar();
  const inicio = await fetch(base); assert.equal(inicio.status, 200);
  const html = await inicio.text(); assert.match(html, /<div id="root">/);
  assert.match(inicio.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(inicio.headers.get('x-content-type-options'), 'nosniff');
  const asset = html.match(/src="([^"]+\.js)"/)[1];
  assert.equal((await fetch(base + asset)).status, 200);
  assert.equal(await (await fetch(base + '/checkout')).text(), html);
  const health = await (await fetch(base + '/api/health')).json();
  assert.equal(health.ambiente, 'production'); assert.equal(health.erp, 'ok');
  assert.equal((await fetch(base + '/api/carrinhos')).status, 401);
  assert.equal((await fetch(base + '/api/rota-inexistente')).status, 404);
  assert.equal((await fetch(base + '/api')).status, 404);
  const catalogo = await chamada('/api/catalogo?busca=Filtro&pagina=1');
  assert.equal(catalogo.json.dados[0].codigo, 'FIL');
  assert.equal(catalogo.res.headers.get('cache-control'), 'private, no-store');
  assert.ok((await chamada('/api/catalogo/categorias')).json.dados.includes('TESTE'));
  assert.equal((await chamada('/api/catalogo/FIL')).json.dados.codigo, 'FIL');
  const cadastro = await chamada('/api/auth/cadastro', 'POST', {
    nome: 'Conta ficticia smoke', email: 'smoke-producao@example.test', senha: 'TesteLocal123', documento: '00000000000',
  });
  assert.equal(cadastro.res.status, 201);
  const login = await chamada('/api/auth/login', 'POST', { email: e.a.email, senha: 'TesteLocal123' });
  const setCookie = login.res.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /Secure/i); assert.match(setCookie, /SameSite=Lax/i);
  cookie = setCookie.split(';')[0];
  assert.doesNotMatch(setCookie, /(?:^|;)\s*Domain=/i);
  assert.equal((await chamada('/api/auth/eu')).json.dados.id, e.a.id);
  const carrinho = (await chamada('/api/carrinhos', 'POST', { nome: 'Persistencia smoke' })).json.dados;
  await chamada(`/api/carrinhos/${carrinho.id}/ativar`, 'PUT');
  await chamada('/api/carrinho/itens', 'POST', { codigo_produto: 'FIL', quantidade: 2 });
  await chamada('/api/carrinho/itens/FIL', 'PATCH', { quantidade: 3 });
  assert.equal((await chamada('/api/carrinho')).json.dados.quantidade_pecas, 3);
  await chamada('/api/perfil', 'PATCH', { telefone: '11999998888' });
  assert.equal((await chamada('/api/perfil')).json.dados.telefone, '11999998888');
  const endereco = (await chamada('/api/enderecos', 'POST', e.endereco('Smoke'))).json.dados;
  await chamada(`/api/enderecos/${endereco.id}`, 'PUT', { ...e.endereco('Smoke atualizado'), numero: '20' });
  assert.ok((await chamada('/api/enderecos')).json.dados.some(item => item.id === endereco.id && item.numero === '20'));
  await chamada(`/api/enderecos/${endereco.id}`, 'DELETE');
  const origem = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Cookie: cookie, Origin: 'https://nao-autorizado.test' } });
  assert.equal(origem.status, 403); assert.equal(origem.headers.get('access-control-allow-origin'), null);
  const preflight = await fetch(base + '/api/carrinhos', { method: 'OPTIONS', headers: {
    Origin: 'https://loja.example.test', 'Access-Control-Request-Method': 'POST',
  } });
  assert.equal(preflight.status, 204);
  await parar(); await iniciar();
  const preservado = (await chamada('/api/carrinho')).json.dados;
  assert.equal(preservado.id, carrinho.id); assert.equal(preservado.quantidade_pecas, 3);
  assert.equal((await chamada('/api/auth/eu')).json.dados.id, e.a.id);
  await chamada('/api/carrinho/itens/FIL', 'DELETE');
  const outroLogin = await chamada('/api/auth/login', 'POST', { email: e.b.email, senha: 'TesteLocal123' });
  const cookieA = cookie;
  cookie = outroLogin.res.headers.get('set-cookie').split(';')[0];
  assert.equal((await chamada('/api/auth/eu')).json.dados.id, e.b.id);
  assert.notEqual((await chamada('/api/carrinho')).json.dados.id, carrinho.id);
  const alheio = await fetch(`${base}/api/carrinhos/${carrinho.id}/ativar`, { method: 'PUT', headers: { Cookie: cookie } });
  assert.equal(alheio.status, 404);
  await chamada('/api/auth/logout', 'POST');
  assert.equal((await fetch(base + '/api/auth/eu', { headers: { Cookie: cookie } })).status, 401);
  cookie = cookieA;
  await chamada('/api/auth/logout', 'POST');
  assert.equal((await fetch(base + '/api/auth/eu', { headers: { Cookie: cookie } })).status, 401);
  assert.equal(e.pedidos.length, 0);
  console.log('Smoke de producao aprovado: HTML/assets/SPA, health/catalogo mock, headers, cookies Secure/HttpOnly/Lax, CORS, login/logout, carrinhos e persistencia apos reinicio. Zero pedidos enviados.');
} finally { await parar(); await e.fechar(); }
