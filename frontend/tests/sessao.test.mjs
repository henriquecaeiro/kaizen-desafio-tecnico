import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, esperar } from './navegador.mjs';
let e;
before(async () => { e = await abrirNavegador(); });
after(async () => { await e?.fechar(); });

test('login carrega unidades; logout e outra conta limpam o estado', async () => {
  e.semear([['FIL', 3], ['SUS', 4]]);
  await e.entrar();
  await esperar(async () => assert.equal(await e.page.getByLabel('7 itens no carrinho').count(), 1));
  await e.page.getByRole('button', { name: 'Sair' }).click();
  await esperar(async () => assert.equal(await e.page.getByLabel('7 itens no carrinho').count(), 0));
  await e.entrar('b');
  await e.page.goto(`${e.base}/carrinho`);
  await e.page.getByText('Seu carrinho está vazio', { exact: true }).waitFor();
  assert.equal(await e.page.getByText('Filtro', { exact: true }).count(), 0);
});
test('resposta atrasada de A nao sobrescreve carrinho de B', async () => {
  await e.page.getByRole('button', { name: 'Sair' }).click();
  let liberar;
  const barreira = new Promise(r => { liberar = r; });
  let recebeu;
  const recebida = new Promise(r => { recebeu = r; });
  let primeira = true;
  let terminou;
  const terminada = new Promise(r => { terminou = r; });
  const handler = async route => {
    if (!primeira) return route.continue();
    primeira = false;
    const resposta = await route.fetch(); recebeu(); await barreira;
    await route.fulfill({ response: resposta }); terminou();
  };
  await e.page.route('**/api/carrinho', handler);
  await e.entrar('a'); await recebida;
  await e.page.getByRole('button', { name: 'Sair' }).click();
  await e.entrar('b');
  await e.page.getByRole('link', { name: 'Carrinho', exact: true }).click();
  liberar(); await terminada;
  await e.page.getByText('Seu carrinho está vazio', { exact: true }).waitFor();
  assert.equal(await e.page.getByLabel('7 itens no carrinho').count(), 0);
  await e.page.unroute('**/api/carrinho', handler);
});
test('leitura antiga nao sobrescreve uma inclusao mais recente', async () => {
  await e.page.getByRole('button', { name: 'Sair' }).click();
  e.semear([]);
  let liberar, recebeu, terminou;
  const barreira = new Promise(r => { liberar = r; });
  const recebida = new Promise(r => { recebeu = r; });
  const terminada = new Promise(r => { terminou = r; });
  let primeira = true;
  const handler = async route => {
    if (!primeira) return route.continue();
    primeira = false;
    const resposta = await route.fetch(); recebeu(); await barreira;
    await route.fulfill({ response: resposta }); terminou();
  };
  await e.page.route('**/api/carrinho', handler);
  await e.entrar('a'); await recebida;
  await e.page.getByRole('button', { name: 'Adicionar' }).first().click();
  await esperar(async () => assert.equal(await e.page.getByLabel('1 itens no carrinho').count(), 1));
  liberar(); await terminada;
  await e.page.getByRole('link', { name: /Carrinho/ }).click();
  await e.page.getByText('Filtro', { exact: true }).waitFor();
  assert.equal(await e.page.getByLabel('1 itens no carrinho').count(), 1);
  await e.page.unroute('**/api/carrinho', handler);
  await e.page.getByRole('button', { name: 'Sair' }).click();
  await e.entrar('b'); await e.page.getByRole('link', { name: /Carrinho/ }).click();
});
test('erro de leitura aparece como erro e permite tentar novamente', async () => {
  await e.page.route('**/api/carrinho', route => route.fulfill({ status: 502, json: { erro: { codigo: 'ERP_INDISPONIVEL', mensagem: 'Falha de teste' } } }));
  await e.page.reload();
  await e.page.getByText('Não foi possível carregar o carrinho', { exact: true }).waitFor();
  assert.equal(await e.page.getByText('Seu carrinho está vazio', { exact: true }).count(), 0);
  await e.page.unroute('**/api/carrinho');
  await e.page.getByRole('button', { name: 'Tentar novamente' }).click();
  await e.page.getByText('Seu carrinho está vazio', { exact: true }).waitFor();
  assert.deepEqual(e.erros, []);
});
