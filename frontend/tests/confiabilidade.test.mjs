import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, esperar } from './navegador.mjs';
const e = await abrirNavegador();
const s = await import('../../backend/src/services/carrinhosService.js');
after(e.fechar);

test('duas abas: mudança de conta não exibe carrinho da nova identidade na aba antiga', async () => {
  e.semear([['FIL', 2]]); e.semear([['SUS', 7]], e.b.id); await e.entrar();
  await e.page.goto(e.base + '/carrinho');
  await e.page.getByLabel('Quantidade de Filtro', { exact: true }).waitFor();
  const segunda = await e.context.newPage();
  try {
    await segunda.goto(e.base + '/entrar');
    await segunda.getByLabel('E-mail', { exact: true }).fill(e.b.email);
    await segunda.getByLabel('Senha', { exact: true }).fill('TesteLocal123');
    await segunda.getByRole('button', { name: 'Entrar', exact: true }).click(); await segunda.waitForURL(e.base + '/');
    await segunda.getByRole('button', { name: 'Ver carrinho (7)' }).waitFor();
    await e.page.getByLabel('Quantidade de Amortecedor', { exact: true }).waitFor();
    assert.equal(await e.page.getByLabel('Quantidade de Filtro', { exact: true }).count(), 0);
    assert.equal(await e.page.getByRole('button', { name: 'Sair', exact: true }).getAttribute('title'), e.b.email);
    assert.equal((await e.carrinho.lerCarrinho(e.a.id)).quantidade_pecas, 2);
    await segunda.getByRole('button', { name: 'Sair', exact: true }).click();
    await e.page.getByRole('link', { name: 'Entrar', exact: true }).waitFor();
    assert.equal(await e.page.getByLabel('7 itens no carrinho', { exact: true }).count(), 0);
  } finally { await segunda.close(); }
});
test('duas abas: seleção muda durante leitura lenta e interface aplica um conjunto coerente', async () => {
  e.semear([['FIL', 1]]); await e.entrar();
  await e.page.getByRole('button', { name: 'Ver carrinho (1)' }).waitFor();
  const antigo = s.obterCarrinhoAtivo(e.a.id).id;
  const novo = s.criarCarrinho(e.a.id, 'Segundo orçamento');
  let liberar, recebeu;
  const barreira = new Promise(r => { liberar = r; });
  const recebida = new Promise(r => { recebeu = r; }); let primeira = true;
  const handler = async route => {
    if (!primeira) return route.continue(); primeira = false;
    const resposta = await route.fetch(); recebeu(); await barreira; await route.fulfill({ response: resposta });
  };
  await e.page.route('**/api/carrinho', handler);
  const segunda = await e.context.newPage();
  try {
    await e.page.goto(e.base + '/carrinho'); await recebida;
    await segunda.goto(e.base + '/carrinho');
    await esperar(async () => assert.equal(await segunda.getByLabel('Carrinho ativo', { exact: true }).inputValue(), String(antigo)));
    await segunda.getByLabel('Carrinho ativo', { exact: true }).selectOption(String(novo.id));
    await segunda.getByText('Seu carrinho está vazio', { exact: true }).waitFor(); liberar();
    await e.page.getByText('Seu carrinho está vazio', { exact: true }).waitFor();
    assert.equal(await e.page.getByLabel('Carrinho ativo', { exact: true }).inputValue(), String(novo.id));
    assert.equal(await e.page.getByLabel('Quantidade de Filtro', { exact: true }).count(), 0);
    assert.equal((await e.carrinho.lerCarrinho(e.a.id, e.db, antigo)).quantidade_pecas, 1);
  } finally { liberar(); await e.page.unroute('**/api/carrinho', handler); await segunda.close(); s.ativarCarrinho(e.a.id, antigo); }
});
test('backend indisponível informa erro e nova tentativa recupera; sessão expirada limpa itens', async () => {
  await e.entrar(); await e.page.goto(e.base + '/carrinho');
  await e.page.getByLabel('Quantidade de Filtro', { exact: true }).waitFor();
  const handler = route => route.abort('connectionfailed');
  await e.page.route('**/api/carrinho', handler); await e.page.reload();
  await e.page.getByText('Não foi possível carregar o carrinho', { exact: true }).waitFor();
  assert.equal(await e.page.getByText('Seu carrinho está vazio', { exact: true }).count(), 0);
  await e.page.unroute('**/api/carrinho', handler);
  await e.page.getByRole('button', { name: 'Tentar novamente' }).click();
  await e.page.getByLabel('Quantidade de Filtro', { exact: true }).waitFor();
  e.db.prepare('DELETE FROM sessoes WHERE usuario_id=?').run(e.a.id);
  await e.page.getByLabel('Quantidade de Filtro', { exact: true }).fill('2');
  await e.page.getByLabel('Quantidade de Filtro', { exact: true }).press('Enter');
  await e.page.getByRole('alert').waitFor();
  await esperar(async () => assert.equal(await e.page.getByLabel('Quantidade de Filtro', { exact: true }).count(), 0));
});
test('nenhum erro JavaScript durante as falhas e recuperações', () => assert.deepEqual(e.erros, []));
