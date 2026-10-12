import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, esperar } from './navegador.mjs';
const e = await abrirNavegador();
after(e.fechar);
e.semear([['FIL', 1]]);

for (const [rota, nome] of [['/', 'catalogo'], ['/produto/FIL', 'produto'], ['/carrinho', 'carrinho']]) {
  test(`imagem do ${nome} usa bypass pelo proxy, conserva alt e carrega data URL`, async () => {
    await e.entrar();
    const requisicoes = [];
    await e.page.route('**/api/imagens/*', async route => {
      const bypass = route.request().headers()['ngrok-skip-browser-warning'];
      requisicoes.push(bypass);
      if (bypass !== '1') return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Aviso ngrok</html>' });
      return route.continue();
    });
    try {
      await e.page.goto(e.base + rota);
      const imagens = e.page.locator('main img');
      await esperar(async () => {
        assert.ok(await imagens.count() > 0);
        assert.ok(await imagens.evaluateAll(lista => lista.every(img => img.src.startsWith('data:image/') && img.naturalWidth > 0)));
      });
      assert.ok(requisicoes.length > 0);
      assert.ok(requisicoes.every(valor => valor === '1'));
      if (nome === 'catalogo') assert.equal(await e.page.getByAltText('Filtro', { exact: true }).count(), 1);
      else assert.equal(await imagens.first().getAttribute('alt'), nome === 'carrinho' ? '' : 'Filtro');
    } finally { await e.page.unroute('**/api/imagens/*'); }
  });
}
test('imagem rejeita HTML intermediario e recupera no refresh sem erro JavaScript', async () => {
  await e.page.route('**/api/imagens/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Aviso ngrok</html>' }));
  await e.page.goto(e.base + '/produto/FIL');
  const imagem = e.page.locator('main img');
  await esperar(async () => assert.equal(await imagem.getAttribute('title'), 'Imagem temporariamente indisponível'));
  assert.equal(await imagem.getAttribute('src'), null);
  await e.page.unroute('**/api/imagens/*');
  await e.page.reload();
  await esperar(async () => assert.ok(await imagem.evaluate(img => img.naturalWidth > 0 && img.src.startsWith('data:image/'))));
  assert.deepEqual(e.erros, []);
});
