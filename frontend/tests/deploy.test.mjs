import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onPreBuild } from '../netlify/index.js';

function configurar(url) {
  const anterior = process.env.NGROK_URL;
  if (url === undefined) delete process.env.NGROK_URL;
  else process.env.NGROK_URL = url;
  const netlifyConfig = { redirects: [{ from: '/*', to: '/index.html', status: 200 }] };
  try {
    onPreBuild({ netlifyConfig, utils: { build: { failBuild(mensagem) { throw new Error(mensagem); } } } });
    return netlifyConfig.redirects;
  } finally {
    if (anterior === undefined) delete process.env.NGROK_URL;
    else process.env.NGROK_URL = anterior;
  }
}

test('Netlify usa base frontend, publish relativo e build sem dependencias backend', () => {
  const toml = fs.readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');
  assert.match(toml, /base = "frontend"/);
  assert.match(toml, /command = "npm run build"/);
  assert.match(toml, /publish = "dist"/);
  assert.match(toml, /package = "\.\/netlify"/);
  assert.equal(fs.existsSync(new URL('../../docs/', import.meta.url)), false);
});
test('proxy usa HTTPS do ambiente, preserva prefixo e precede fallback SPA', () => {
  // Dominio ficticio somente neste teste; nao e configuracao de publicacao.
  const regras = configurar('https://teste-fixture.ngrok-free.app/');
  assert.deepEqual(regras[0], { from: '/api/*', to: 'https://teste-fixture.ngrok-free.app/api/:splat',
    status: 200, force: true, headers: { 'ngrok-skip-browser-warning': '1' } });
  assert.deepEqual(regras[1], { from: '/*', to: '/index.html', status: 200 });
});
test('deploy sem URL real para antes de publicar uma API inexistente', () => {
  for (const url of [undefined, '', 'DOMINIO-REAL-DO-NGROK'])
    assert.throws(() => configurar(url), /Configure NGROK_URL/);
});
test('proxy rejeita HTTP, credenciais, caminhos, parametros e hosts arbitrarios sem expor valores', () => {
  for (const url of ['http://teste.ngrok.app', 'https://segredo@teste.ngrok.app',
    'https://teste.ngrok.app:444', 'https://teste.ngrok.app/api', 'https://teste.ngrok.app?token=segredo',
    'https://teste.ngrok.app#segredo', 'https://teste.ngrok.app.atacante.test']) {
    assert.throws(() => configurar(url), erro => /Configure NGROK_URL/.test(erro.message) && !erro.message.includes('segredo'));
  }
});
test('frontend preserva API relativa e cookie da mesma origem', () => {
  const cliente = fs.readFileSync(new URL('../src/api/cliente.js', import.meta.url), 'utf8');
  assert.match(cliente, /['"]\/api['"]/);
  assert.match(cliente, /credentials:\s*['"]include['"]/);
  assert.doesNotMatch(cliente, /ngrok|localStorage/);
});
