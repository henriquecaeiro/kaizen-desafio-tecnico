import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, esperar } from './navegador.mjs';
let e;
before(async () => {
  e = await abrirNavegador();
  for (let i = 1; i <= 60; i++) e.produtos.set(`PEC-${i}`, { ...e.produtos.get('FIL'), codigo: `PEC-${i}`, descricao: `Peca ${i}`, categoria: i <= 30 ? 'FREIOS' : 'TESTE' });
});
after(async () => { await e?.fechar(); });
const buscar = async texto => {
  await e.page.getByLabel('Buscar peças').fill(texto);
  await e.page.getByLabel('Buscar peças').press('Enter');
};
const params = () => new URL(e.page.url()).searchParams;

test('buscar na primeira pagina e depois de paginar reinicia pagina preservando filtros', async () => {
  await e.page.goto(e.base);
  await buscar('amortecedor');
  await e.page.getByRole('heading', { name: 'Amortecedor', exact: true }).waitFor();
  assert.equal(params().get('pagina'), null);
  await e.page.goto(`${e.base}/?pagina=2&categoria=TESTE&somente_disponiveis=true`);
  await buscar('amortecedor');
  await e.page.getByRole('heading', { name: 'Amortecedor', exact: true }).waitFor();
  assert.equal(params().get('pagina'), null);
  assert.equal(params().get('categoria'), 'TESTE'); assert.equal(params().get('somente_disponiveis'), 'true');
});
test('categoria, disponibilidade e limpeza reiniciam pagina; URL acompanha historico e refresh', async () => {
  await e.page.goto(`${e.base}/?pagina=2&busca=peca&somente_disponiveis=true`);
  await e.page.getByRole('button', { name: 'freios', exact: true }).click();
  await esperar(() => assert.equal(params().get('pagina'), null));
  assert.equal(params().get('busca'), 'peca'); assert.equal(params().get('categoria'), 'FREIOS');
  await e.page.getByRole('button', { name: 'Próxima', exact: true }).click();
  await esperar(() => assert.equal(params().get('pagina'), '2'));
  await e.page.getByLabel('Só com estoque').click();
  await esperar(() => assert.equal(params().get('pagina'), null));
  await esperar(async () => assert.equal(await e.page.getByLabel('Só com estoque').isChecked(), false));
  assert.equal(params().get('categoria'), 'FREIOS'); assert.equal(params().get('busca'), 'peca');
  await e.page.getByRole('button', { name: 'limpar', exact: true }).click();
  await esperar(async () => assert.equal(await e.page.getByLabel('Buscar peças').inputValue(), ''));
  assert.equal(params().get('categoria'), 'FREIOS');
  await e.page.goBack();
  await esperar(async () => assert.equal(await e.page.getByLabel('Buscar peças').inputValue(), 'peca'));
  await e.page.goForward();
  await esperar(async () => assert.equal(await e.page.getByLabel('Buscar peças').inputValue(), ''));
  await e.page.reload();
  assert.equal(params().get('categoria'), 'FREIOS');
  await buscar('inexistente');
  await e.page.getByRole('button', { name: 'Limpar filtros' }).click();
  await esperar(() => assert.equal(params().toString(), ''));
});
test('paginacao compartilhada permite ultima pagina em listas com uma, duas e tres paginas', async () => {
  for (const [query, paginas] of [['busca=amortecedor', 1], ['categoria=FREIOS', 2], ['', 3]]) {
    await e.page.goto(`${e.base}/?${query}`);
    await e.page.locator('article').first().waitFor();
    if (paginas === 1) {
      assert.equal(await e.page.getByRole('button', { name: 'Próxima' }).count(), 0);
      continue;
    }
    for (let p = 1; p < paginas; p++) {
      await e.page.getByText(`Página ${p} de ${paginas}`, { exact: false }).waitFor();
      assert.equal(await e.page.getByRole('button', { name: 'Próxima' }).isEnabled(), true);
      await e.page.getByRole('button', { name: 'Próxima' }).click();
      await e.page.getByText(`Página ${p + 1} de ${paginas}`, { exact: false }).waitFor();
      if (query) assert.equal(params().get('categoria'), 'FREIOS');
    }
    assert.equal(await e.page.getByRole('button', { name: 'Próxima' }).isDisabled(), true);
  }
});
test('resposta antiga do catalogo nao substitui pesquisa mais recente', async () => {
  let liberar, recebeu, terminou;
  const barreira = new Promise(r => { liberar = r; });
  const recebida = new Promise(r => { recebeu = r; });
  const terminada = new Promise(r => { terminou = r; });
  await e.page.route('**/api/catalogo?*', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('busca') !== 'filtro') return route.continue();
    const resposta = await route.fetch(); recebeu(); await barreira;
    await route.fulfill({ response: resposta }); terminou();
  });
  await e.page.goto(e.base);
  await buscar('filtro'); await recebida;
  await buscar('amortecedor');
  await e.page.getByRole('heading', { name: 'Amortecedor', exact: true }).waitFor();
  liberar(); await terminada;
  assert.equal(await e.page.getByRole('heading', { name: 'Filtro', exact: true }).count(), 0);
  assert.equal(params().get('busca'), 'amortecedor');
  await e.page.unroute('**/api/catalogo?*');
  assert.deepEqual(e.erros, []);
});

test('listagem de pedidos tambem navega ate a terceira pagina', async () => {
  for (let i = 1; i <= 21; i++) {
    const numero = `LISTA-${i}`;
    e.pedidos.push({ numero, situacao: 'ABERTO', quantidade_itens: 1, valor_total: 10,
      criado_em: new Date().toISOString(), cliente: { nome: 'Pessoa A', documento: '00000000000' },
      itens: [{ codigo_produto: 'FIL', descricao: 'Filtro', quantidade: 1, preco_unitario: 10, valor_total: 10 }] });
    e.db.prepare('INSERT INTO pedidos_usuario(usuario_id,numero_erp,endereco_entrega,valor_total_centavos,criado_em) VALUES(?,?,?,?,?)')
      .run(e.a.id, numero, JSON.stringify(e.casa), 1000, new Date().toISOString());
  }
  await e.entrar();
  await e.page.getByRole('link', { name: 'Pedidos', exact: true }).click();
  await e.page.getByText('Página 1 de 3', { exact: false }).waitFor();
  await e.page.getByRole('button', { name: 'Próxima' }).click();
  await e.page.getByText('Página 2 de 3', { exact: false }).waitFor();
  assert.equal(await e.page.getByRole('button', { name: 'Próxima' }).isEnabled(), true);
  await e.page.getByRole('button', { name: 'Próxima' }).click();
  await e.page.getByText('Página 3 de 3', { exact: false }).waitFor();
  assert.equal(await e.page.getByRole('button', { name: 'Próxima' }).isDisabled(), true);
});
