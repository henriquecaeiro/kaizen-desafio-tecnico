import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, esperar } from './navegador.mjs';

const e = await abrirNavegador();
after(e.fechar);

test('falha do catalogo nao mostra vazio ou resultados antigos; retry preserva filtros', async () => {
  let falhar = true;
  const handler = route => falhar
    ? route.fulfill({ status: 502, json: { erro: { codigo: 'ERP_INDISPONIVEL', mensagem: 'Falha simulada do catalogo' } } })
    : route.continue();
  await e.page.route('**/api/catalogo?*', handler);
  try {
    await e.page.goto(`${e.base}/?categoria=TESTE`);
    await e.page.getByRole('alert').waitFor();
    assert.equal(await e.page.getByText('Nenhuma peça encontrada', { exact: true }).count(), 0);
    falhar = false;
    await e.page.getByRole('button', { name: 'Tentar novamente' }).click();
    await e.page.getByRole('heading', { name: 'Filtro', exact: true }).waitFor();
    assert.equal(new URL(e.page.url()).searchParams.get('categoria'), 'TESTE');
    falhar = true;
    await e.page.getByLabel('Buscar peças').fill('amortecedor');
    await e.page.getByLabel('Buscar peças').press('Enter');
    await e.page.getByRole('alert').waitFor();
    assert.equal(await e.page.locator('article').count(), 0);
    falhar = false;
    await e.page.getByRole('button', { name: 'Tentar novamente' }).click();
    await e.page.getByRole('heading', { name: 'Amortecedor', exact: true }).waitFor();
    assert.equal(await e.page.getByRole('alert').count(), 0);
  } finally { await e.page.unroute('**/api/catalogo?*', handler); }
});

test('salvar perfil com resposta atrasada nao troca a identidade de outra sessao', async () => {
  await e.entrar();
  let liberar, recebeu;
  const barreira = new Promise(r => { liberar = r; });
  const recebida = new Promise(r => { recebeu = r; });
  const handler = async route => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const resposta = await route.fetch(); recebeu(); await barreira;
    await route.fulfill({ response: resposta });
  };
  await e.page.route('**/api/perfil', handler);
  try {
    await e.page.getByRole('link', { name: 'Perfil', exact: true }).click();
    await e.page.getByLabel('Nome completo').fill('Pessoa A atualizada');
    await e.page.getByRole('button', { name: 'Salvar dados' }).click();
    await recebida;
    await e.page.getByRole('button', { name: 'Sair', exact: true }).click();
    await e.page.getByRole('link', { name: 'Entrar', exact: true }).click();
    await e.page.getByLabel('E-mail').fill(e.b.email);
    await e.page.getByLabel('Senha', { exact: true }).fill('TesteLocal123');
    await e.page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await e.page.getByRole('button', { name: 'Sair', exact: true }).waitFor();
    const resposta = e.page.waitForResponse(r => r.url().endsWith('/api/perfil') && r.request().method() === 'PATCH');
    liberar(); await (await resposta).finished();
    await e.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.equal(await e.page.getByRole('button', { name: 'Sair', exact: true }).getAttribute('title'), e.b.email);
    await e.page.getByRole('link', { name: 'Perfil', exact: true }).click();
    assert.equal(await e.page.getByLabel('E-mail', { exact: true }).inputValue(), e.b.email);
    assert.equal((await e.page.request.get(`${e.base}/api/auth/eu`)).status(), 200);
  } finally { liberar(); await e.page.unroute('**/api/perfil', handler); }
});

test('logout que falha informa o erro e permite repetir a revogacao', async () => {
  await e.entrar('b');
  const handler = route => route.fulfill({ status: 503, json: { erro: { codigo: 'FALHA', mensagem: 'Falha simulada de logout' } } });
  await e.page.route('**/api/auth/logout', handler);
  try {
    await e.page.getByRole('button', { name: 'Sair', exact: true }).click();
    await e.page.getByRole('alert').filter({ hasText: 'Falha simulada de logout' }).waitFor({ timeout: 5000 });
    assert.equal((await e.page.request.get(`${e.base}/api/auth/eu`)).status(), 200);
    assert.equal(await e.page.getByRole('button', { name: 'Sair', exact: true }).count(), 1);
  } finally { await e.page.unroute('**/api/auth/logout', handler); }
  await e.page.getByRole('button', { name: 'Sair', exact: true }).click();
  await e.page.getByRole('link', { name: 'Entrar', exact: true }).waitFor();
  assert.equal((await e.page.request.get(`${e.base}/api/auth/eu`)).status(), 401);
  assert.deepEqual(e.erros, []);
});

test('inclusoes que terminam fora de ordem atualizam o contador com ambas as pecas', async () => {
  e.semear([]);
  await e.entrar();
  await e.page.getByRole('button', { name: 'Ver carrinho (0)' }).waitFor();
  let liberar, recebeu;
  const barreira = new Promise(r => { liberar = r; });
  const recebida = new Promise(r => { recebeu = r; });
  const handler = async route => {
    if (route.request().postDataJSON().codigo_produto === 'FIL') { recebeu(); await barreira; }
    await route.continue();
  };
  await e.page.route('**/api/carrinho/itens', handler);
  try {
    const card = nome => e.page.locator('article').filter({ has: e.page.getByRole('heading', { name: nome, exact: true }) });
    await card('Filtro').getByRole('button', { name: 'Adicionar', exact: true }).click();
    await recebida;
    await card('Amortecedor').getByRole('button', { name: 'Adicionar', exact: true }).click();
    await e.page.getByLabel('1 itens no carrinho', { exact: true }).waitFor();
    liberar();
    await esperar(async () => assert.equal(await e.page.getByLabel('2 itens no carrinho', { exact: true }).count(), 1));
    assert.equal((await e.carrinho.lerCarrinho(e.a.id)).quantidade_pecas, 2);
  } finally { liberar(); await e.page.unroute('**/api/carrinho/itens', handler); }
});
