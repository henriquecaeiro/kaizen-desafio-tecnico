import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { prepararAmbiente } from '../test-support/ambiente.mjs';
const e = await prepararAmbiente();
after(e.fechar);

test('origem permitida recebe CORS com credenciais e Vary', async () => {
  const r = await e.chamada('/catalogo', { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(r.headers.get('access-control-allow-credentials'), 'true');
  assert.match(r.headers.get('vary'), /Origin/);
});
test('origens arbitrarias, null e sufixos parecidos sao rejeitados sem headers permissivos', async () => {
  for (const Origin of ['https://outro.example.test', 'null', 'http://localhost:5173.atacante.test']) {
    const r = await e.chamada('/auth/logout', { metodo: 'POST', headers: { Origin } });
    assert.equal(r.status, 403);
    assert.equal(r.headers.get('access-control-allow-origin'), null);
    assert.equal(r.headers.get('access-control-allow-credentials'), null);
    assert.equal(r.headers.get('set-cookie'), null);
  }
});
test('requisicao sem Origin continua funcionando sem liberar CORS', async () => {
  const r = await e.chamada('/catalogo');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});
test('preflight permitido retorna 204 e o nao permitido retorna 403', async () => {
  for (const [Origin, status] of [['http://localhost:5173', 204], ['https://outro.test', 403]]) {
    const r = await e.chamada('/carrinho/itens', { metodo: 'OPTIONS', headers: {
      Origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-carrinho-id',
    } });
    assert.equal(r.status, status);
    if (status === 204) assert.match(r.headers.get('access-control-allow-headers'), /X-Carrinho-Id/);
    else assert.equal(r.headers.get('access-control-allow-origin'), null);
  }
});
