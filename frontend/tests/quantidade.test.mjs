import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, esperar } from './navegador.mjs';

const e = await abrirNavegador();
const s = await import('../../backend/src/services/carrinhosService.js');
after(e.fechar);
const campo = () => e.page.getByLabel('Quantidade de Filtro', { exact: true });
async function abrir(painel = false) {
  e.semear([['FIL', 1]]);
  await e.entrar();
  if (painel) await e.page.getByRole('button', { name: 'Ver carrinho (1)' }).click();
  else await e.page.goto(e.base + '/carrinho');
  await campo().waitFor();
}
async function persistido(quantidade) {
  await esperar(async () => assert.equal((await e.carrinho.lerCarrinho(e.a.id)).itens[0].quantidade, quantidade));
  await esperar(async () => assert.equal(await e.page.getByLabel(`${quantidade} itens no carrinho`, { exact: true }).count(), 1));
}
for (const painel of [false, true]) test(`quantidade ${painel ? 'painel' : 'página'}: apagar, Enter, setas, Tab e refresh`, async () => {
  await abrir(painel);
  await campo().fill(''); assert.equal(await campo().inputValue(), '');
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).quantidade_pecas, 1);
  await campo().fill('3'); await campo().press('Enter'); await persistido(3);
  assert.equal(await campo().evaluate(el => document.activeElement === el), true);
  await campo().fill('1'); await campo().press('Enter'); await persistido(1);
  for (let i = 0; i < 3; i++) await campo().press('ArrowUp');
  assert.equal(await campo().inputValue(), '4');
  assert.equal(await campo().evaluate(el => document.activeElement === el), true);
  await campo().press('Enter'); await persistido(4);
  await campo().press('ArrowDown'); await campo().press('ArrowDown');
  assert.equal(await campo().inputValue(), '2');
  await campo().press('Tab'); await persistido(2);
  await e.page.reload();
  if (painel) await e.page.getByRole('button', { name: 'Ver carrinho (2)' }).click();
  await campo().waitFor(); assert.equal(await campo().inputValue(), '2');
});
test('quantidades vazias, negativas, fracionárias e acima do limite não geram escrita', async () => {
  await abrir(); let escritas = 0;
  const contar = req => { if (req.method() === 'PATCH' && req.url().includes('/api/carrinho/itens/')) escritas++; };
  e.page.on('request', contar);
  try {
    for (const valor of ['', '0', '-1', '1.5', '100']) {
      await campo().fill(valor); await campo().press('Tab');
      await e.page.getByText('Informe uma quantidade inteira de 1 a 99.', { exact: true }).waitFor();
      assert.equal(await campo().inputValue(), '1');
    }
    assert.equal(escritas, 0);
  } finally { e.page.off('request', contar); }
});
for (const painel of [false, true]) test(`setas nativas no ${painel ? 'painel' : 'carrinho'} mantêm foco sem requisições intermediárias`, async () => {
  await abrir(painel);
  const caixa = await campo().boundingBox();
  await campo().hover();
  for (let i = 0; i < 3; i++) await e.page.mouse.click(caixa.x + caixa.width - 18, caixa.y + caixa.height * 0.35);
  assert.equal(await campo().inputValue(), '4');
  assert.equal(await campo().evaluate(el => el === document.activeElement), true);
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).quantidade_pecas, 1);
  for (let i = 0; i < 2; i++) await e.page.mouse.click(caixa.x + caixa.width - 18, caixa.y + caixa.height * 0.7);
  assert.equal(await campo().inputValue(), '2');
  await campo().press('Enter'); await persistido(2);
});
test('edição durante resposta lenta persiste a última quantidade', async () => {
  await abrir(); let liberar, recebeu;
  const barreira = new Promise(r => { liberar = r; });
  const recebida = new Promise(r => { recebeu = r; }); let primeira = true;
  const handler = async route => {
    if (primeira) { primeira = false; recebeu(); await barreira; }
    await route.continue();
  };
  await e.page.route('**/api/carrinho/itens/FIL', handler);
  try {
    await campo().fill('3'); await campo().press('Enter'); await recebida;
    assert.equal(await campo().isEnabled(), true);
    await campo().fill('4'); await campo().press('Enter'); liberar(); await persistido(4);
  } finally { liberar(); await e.page.unroute('**/api/carrinho/itens/FIL', handler); }
});
test('falha ao salvar restaura quantidade confirmada e permite repetir', async () => {
  await abrir();
  const handler = route => route.fulfill({ status: 502, json: { erro: { codigo: 'ERP_INDISPONIVEL', mensagem: 'Falha simulada ao salvar' } } });
  await e.page.route('**/api/carrinho/itens/FIL', handler);
  try {
    await campo().fill('3'); await campo().press('Enter');
    await e.page.getByRole('alert').filter({ hasText: 'Falha simulada ao salvar' }).waitFor();
    await esperar(async () => assert.equal(await campo().inputValue(), '1')); await persistido(1);
  } finally { await e.page.unroute('**/api/carrinho/itens/FIL', handler); }
  await campo().fill('3'); await campo().press('Tab'); await persistido(3);
});
test('troca de ativo durante edição não altera outro carrinho e recupera seleção', async () => {
  await abrir(); const antigo = s.obterCarrinhoAtivo(e.a.id).id;
  const novo = s.criarCarrinho(e.a.id, 'Outra aba');
  await campo().fill('3'); s.ativarCarrinho(e.a.id, novo.id); await campo().press('Enter');
  await e.page.getByText('Seu carrinho está vazio', { exact: true }).waitFor();
  assert.equal((await e.carrinho.lerCarrinho(e.a.id, e.db, antigo)).quantidade_pecas, 1);
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).quantidade_pecas, 0);
  s.ativarCarrinho(e.a.id, antigo);
});
test('erro de leitura mantém itens visíveis e repetir recupera carrinho', async () => {
  await abrir(); e.controle.respostas.set('GET /produtos/FIL', { status: 503, json: {} });
  const handler = route => route.fulfill({ status: 409, json: { erro: { codigo: 'CARRINHO_ALTERADO', mensagem: 'Atualize a seleção' } } });
  await e.page.route('**/api/carrinho/itens/FIL', handler);
  try {
    await campo().fill('2'); await campo().press('Enter');
    await e.page.getByText('Não foi possível carregar o carrinho', { exact: true }).waitFor();
    assert.equal(await campo().count(), 1);
    assert.equal(await e.page.getByText('Seu carrinho está vazio', { exact: true }).count(), 0);
  } finally { await e.page.unroute('**/api/carrinho/itens/FIL', handler); e.controle.respostas.clear(); }
  await e.page.getByRole('button', { name: 'Tentar novamente' }).click();
  await esperar(async () => assert.equal(await e.page.getByRole('alert').count(), 0)); await persistido(1);
});
