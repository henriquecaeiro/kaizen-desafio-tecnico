import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { api, ErroApi } from '../src/api/cliente.js';

const origemNgrok = 'https://2154-2804-d59-a107-c600-b57-957-65d4-af7d.ngrok-free.app';
const ler = arquivo => fs.readFileSync(new URL(arquivo, import.meta.url), 'utf8');

test('Netlify usa base frontend e build independente de plugins ou variaveis remotas', () => {
  const toml = ler('../../netlify.toml');
  assert.match(toml, /base = "frontend"/);
  assert.match(toml, /command = "npm run build"/);
  assert.match(toml, /publish = "dist"/);
  assert.doesNotMatch(toml, /\[\[plugins\]\]|\[\[redirects\]\]|\[\[headers\]\]|NGROK_URL/);
  assert.equal(fs.existsSync(new URL('../../docs/', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../netlify/index.js', import.meta.url)), false);
});
test('redirects estaticos usam o ngrok real como proxy forcado antes do fallback SPA', () => {
  assert.deepEqual(ler('../public/_redirects').trim().split('\n'), [
    `/api/* ${origemNgrok}/api/:splat 200!`, '/* /index.html 200',
  ]);
  assert.doesNotMatch(ler('../public/_redirects'), /NGROK_URL|example|fixture|token|segredo|301|302/);
});
test('build pronto inclui regras e headers identicos ao public, sem segredos ou fontes', () => {
  for (const arquivo of ['_redirects', '_headers']) assert.equal(ler(`../dist/${arquivo}`), ler(`../public/${arquivo}`));
  const html = ler('../dist/index.html');
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g)].map(m => m[1]);
  assert.ok(assets.some(a => a.endsWith('.js')) && assets.some(a => a.endsWith('.css')));
  for (const arquivo of assets) assert.ok(fs.statSync(new URL(`../dist${arquivo}`, import.meta.url)).size > 0);
  assert.match(ler('../dist/_headers'), /img-src 'self' data:/);
  assert.match(ler('../dist/_headers'), /X-Content-Type-Options: nosniff/);
  assert.match(ler('../dist/_headers'), /Referrer-Policy: same-origin/);
  assert.match(ler('../dist/_headers'), /frame-ancestors 'none'/);
  for (const entrada of fs.readdirSync(new URL('../dist/', import.meta.url), { recursive: true }))
    assert.doesNotMatch(entrada, /(?:^|\/)(?:\.env|node_modules|src)(?:\/|$)|\.(?:db|sqlite|sqlite3|map)$/);
});
test('fetch repassa bypass nao sensivel com query, JSON, cookies e todos os metodos', async t => {
  const chamadas = [];
  t.mock.method(globalThis, 'fetch', async (url, opcoes) => {
    chamadas.push({ url, ...opcoes });
    return new Response(JSON.stringify({ dados: [] }), { headers: { 'Content-Type': 'application/json' } });
  });
  await api.catalogo.listar({ busca: 'filtro de óleo', pagina: 2 });
  await api.auth.entrar({ email: 'fixture@example.test', senha: 'SenhaFicticia123' });
  await api.carrinho.alterar('FIL', 3, 7);
  await api.enderecos.salvar(9, { numero: '20' });
  await api.enderecos.remover(9);
  assert.deepEqual(chamadas.map(c => c.method), ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']);
  assert.equal(new URL(chamadas[0].url, 'https://loja.test').searchParams.get('busca'), 'filtro de óleo');
  assert.equal(chamadas[2].headers['X-Carrinho-Id'], '7');
  assert.deepEqual(JSON.parse(chamadas[2].body), { quantidade: 3 });
  assert.deepEqual(JSON.parse(chamadas[3].body), { numero: '20' });
  for (const chamada of chamadas) {
    assert.ok(chamada.url.startsWith('/api/'));
    assert.equal(chamada.credentials, 'include');
    assert.equal(chamada.headers['ngrok-skip-browser-warning'], '1');
  }
});
test('frontend preserva API relativa e cookie da mesma origem sem URL ngrok ou JWT local', () => {
  const cliente = ler('../src/api/cliente.js');
  assert.match(cliente, /['"]\/api['"]/);
  assert.match(cliente, /credentials:\s*['"]include['"]/);
  assert.doesNotMatch(cliente, /https?:\/\/|localStorage/);
});
test('HTML de aviso, JSON nulo/invalido ou primitivo em HTTP 200 nao viram sucesso', async t => {
  for (const corpo of ['<html>Aviso ngrok</html>', 'invalido', 'null', '123']) {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response(corpo));
    await assert.rejects(api.auth.eu(), erro => erro instanceof ErroApi && erro.codigo === 'RESPOSTA_INVALIDA');
    mock.mock.restore();
  }
});
test('erros HTTP JSON ou HTML conservam status sem expor conteudo remoto', async t => {
  for (const [status, corpo, codigo] of [[401, JSON.stringify({ erro: { codigo: 'SESSAO_INVALIDA', mensagem: 'Sessao expirada' } }), 'SESSAO_INVALIDA'],
    [404, '<html>Pagina de erro externa</html>', 'ERRO_DESCONHECIDO'], [502, '<html>Erro externo</html>', 'ERRO_DESCONHECIDO']]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response(corpo, { status }));
    await assert.rejects(api.auth.eu(), erro => erro.status === status && erro.codigo === codigo && !erro.message.includes('<html>'));
    mock.mock.restore();
  }
});
test('resposta 204 e falha de conexao continuam tratadas corretamente', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  assert.equal(await api.enderecos.remover(9), null);
  mock.mock.restore();
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Falha simulada'); });
  await assert.rejects(api.auth.eu(), erro => erro.codigo === 'SEM_CONEXAO' && erro.status === 0);
});
