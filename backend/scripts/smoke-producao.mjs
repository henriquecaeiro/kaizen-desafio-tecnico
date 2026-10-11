import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prepararAmbiente } from '../test-support/ambiente.mjs';

// Inicia o bootstrap real em production com banco temporario e SIAC mock.
// Rode depois do build do frontend; nao usa a configuracao do banco real.
const e = await prepararAmbiente();
const reserva = http.createServer(); reserva.listen(0, '127.0.0.1'); await once(reserva, 'listening');
const porta = reserva.address().port;
await new Promise(r => reserva.close(r));
const processo = spawn(process.execPath, ['src/server.js'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)),
  env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(porta), CORS_ORIGEM: 'https://loja.example.test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
processo.stdout.on('data', dado => { log += dado; });
processo.stderr.on('data', dado => { log += dado; });
try {
  for (let i = 0; !log.includes('Kaizen Autopecas (loja)'); i++) {
    if (processo.exitCode !== null || i >= 100) throw new Error('Backend de producao nao iniciou.');
    await new Promise(r => setTimeout(r, 25));
  }
  const base = `http://127.0.0.1:${porta}`;
  const inicio = await fetch(base); assert.equal(inicio.status, 200);
  const html = await inicio.text(); assert.match(html, /<div id="root">/);
  const asset = html.match(/src="([^"]+\.js)"/)[1];
  assert.equal((await fetch(base + asset)).status, 200);
  assert.equal(await (await fetch(base + '/checkout')).text(), html);
  const health = await (await fetch(base + '/api/health')).json();
  assert.equal(health.ambiente, 'production'); assert.equal(health.erp, 'ok');
  assert.equal((await fetch(base + '/api/carrinhos')).status, 401);
  assert.equal((await fetch(base + '/api/rota-inexistente')).status, 404);
  console.log('Smoke de producao aprovado: HTML/assets, fallback SPA, health com mock, autenticacao e 404 da API.');
} finally {
  processo.kill('SIGTERM');
  if (processo.exitCode === null) await once(processo, 'exit');
  await e.fechar();
}
