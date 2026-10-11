import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { prepararAmbiente } from '../test-support/ambiente.mjs';
const e = await prepararAmbiente();
after(e.fechar);
beforeEach(() => e.db.prepare('DELETE FROM autenticacao_limites').run());
const tentar = (email, headers = {}) => e.chamada('/auth/login', { metodo: 'POST', headers,
  corpo: { email, senha: 'Errada123' } });

test('limite por conta normaliza e-mail, bloqueia e fornece Retry-After', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await tentar(i % 2 ? ' A@EXAMPLE.TEST ' : e.a.email)).status, 401);
  const r = await tentar(e.a.email);
  assert.equal(r.status, 429); assert.equal(r.json.erro.codigo, 'MUITAS_TENTATIVAS');
  assert.ok(Number(r.headers.get('retry-after')) > 0);
  assert.equal((await tentar(e.b.email)).status, 401);
  assert.ok(e.db.prepare('SELECT chave FROM autenticacao_limites').all().every(r => /^[a-f0-9]{64}$/.test(r.chave)));
});
test('limite por IP nao pode ser burlado alterando X-Forwarded-For', async () => {
  for (let i = 0; i < 30; i++) assert.equal((await tentar(`conta${i}@example.test`, { 'X-Forwarded-For': `192.0.2.${i + 1}` })).status, 401);
  assert.equal((await tentar('outra@example.test', { 'X-Forwarded-For': '198.51.100.1' })).status, 429);
});
test('janela expirada libera tentativas, nao um reinicio da aplicacao', async () => {
  for (let i = 0; i < 10; i++) await tentar(e.a.email);
  const { criarApp } = await import('../src/app.js');
  const servidor = http.createServer(criarApp()); servidor.listen(0, '127.0.0.1'); await once(servidor, 'listening');
  try {
    const r = await fetch(`http://127.0.0.1:${servidor.address().port}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e.a.email, senha: 'TesteLocal123' }),
    });
    assert.equal(r.status, 429);
  } finally { servidor.closeAllConnections(); await new Promise(r => servidor.close(r)); }
  e.db.prepare('UPDATE autenticacao_limites SET expira_em=0').run();
  assert.equal((await tentar(e.a.email)).status, 401);
});
test('cadastro conta payloads invalidos e bloqueia depois de cinco', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await e.chamada('/auth/cadastro', { metodo: 'POST', corpo: {} })).status, 422);
  assert.equal((await e.chamada('/auth/cadastro', { metodo: 'POST', corpo: {} })).status, 429);
});
test('tentativas concorrentes nao ultrapassam o limite da conta', async () => {
  const resultados = await Promise.all(Array.from({ length: 12 }, () => tentar('concorrente@example.test')));
  assert.equal(resultados.filter(r => r.status === 401).length, 10);
  assert.equal(resultados.filter(r => r.status === 429).length, 2);
});
test('proxy explicitamente confiavel usa o primeiro salto nao confiavel', async () => {
  const { criarApp } = await import('../src/app.js');
  e.config.proxiesConfiaveis = ['loopback'];
  const app = criarApp();
  const servidor = http.createServer(app); servidor.listen(0, '127.0.0.1'); await once(servidor, 'listening');
  const chamada = (indice, xff) => fetch(`http://127.0.0.1:${servidor.address().port}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': xff },
    body: JSON.stringify({ email: `proxy${indice}@example.test`, senha: 'Errada123' }),
  });
  try {
    for (let i = 0; i < 30; i++) assert.equal((await chamada(i, `192.0.2.${i + 1}, 198.51.100.1`)).status, 401);
    assert.equal((await chamada(31, '192.0.2.250, 198.51.100.1')).status, 429);
    assert.equal((await chamada(32, '198.51.100.2')).status, 401);
  } finally {
    servidor.closeAllConnections(); await new Promise(r => servidor.close(r)); e.config.proxiesConfiaveis = [];
  }
});
