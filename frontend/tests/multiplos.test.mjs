import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, esperar, caminhoCaptura } from './navegador.mjs';
let e, s;
before(async () => {
  e = await abrirNavegador(); s = await import('../../backend/src/services/carrinhosService.js');
  e.semear([['FIL', 3], ['SUS', 4]]);
});
after(async () => { await e?.fechar(); });
const painel = () => e.page.getByRole('complementary', { name: 'Meu carrinho' });
async function criar(nome) {
  await e.page.getByRole('button', { name: 'Novo carrinho', exact: true }).click();
  await e.page.getByRole('textbox', { name: 'Nome do carrinho' }).fill(nome);
  await e.page.getByRole('button', { name: 'Salvar carrinho' }).click();
  await esperar(async () => assert.equal(await e.page.getByLabel('Carrinho ativo', { exact: true }).inputValue(), String(s.obterCarrinhoAtivo(e.a.id).id)));
  await esperar(async () => assert.equal(await e.page.getByRole('textbox', { name: 'Nome do carrinho' }).count(), 0));
}

test('painel cria, renomeia e troca carrinhos sem perder busca e pagina', async () => {
  for (let i = 1; i <= 30; i++) e.produtos.set(`EXTRA-${i}`, { ...e.produtos.get('FIL'), codigo: `EXTRA-${i}`, descricao: `Filtro extra ${i}` });
  await e.entrar();
  await e.page.goto(`${e.base}/?busca=filtro&categoria=TESTE&pagina=2`);
  const url = e.page.url(); const primeiro = s.obterCarrinhoAtivo(e.a.id).id;
  await e.page.getByRole('button', { name: 'Ver carrinho (7)' }).click();
  await painel().waitFor();
  await criar('Gol do Joao');
  assert.equal(e.page.url(), url);
  assert.equal(await painel().getByText('Seu carrinho está vazio', { exact: true }).count(), 1);
  await e.page.getByRole('button', { name: 'Renomear', exact: true }).click();
  await e.page.getByRole('textbox', { name: 'Nome do carrinho' }).fill('Civic prata');
  await e.page.getByRole('button', { name: 'Salvar carrinho' }).click();
  await esperar(async () => assert.equal(await e.page.getByRole('textbox', { name: 'Nome do carrinho' }).count(), 0));
  await e.page.getByLabel('Carrinho ativo', { exact: true }).selectOption(String(primeiro));
  await painel().getByText('Filtro', { exact: true }).waitFor();
  assert.equal(await e.page.getByLabel('7 itens no carrinho').count(), 1);
  assert.equal(e.page.url(), url);
  await e.page.getByLabel('Quantidade de Filtro', { exact: true }).fill('2');
  await e.page.getByLabel('Quantidade de Filtro', { exact: true }).press('Enter');
  await esperar(async () => assert.equal(await e.page.getByLabel('6 itens no carrinho').count(), 1));
  assert.equal(e.page.url(), url);
});
test('exclusao tem confirmacao, promove outro e persistencia sobrevive ao refresh', async () => {
  const excluido = s.obterCarrinhoAtivo(e.a.id).id;
  await e.page.getByRole('button', { name: 'Excluir', exact: true }).click();
  assert.equal(s.obterCarrinhoAtivo(e.a.id).id, excluido);
  await e.page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await esperar(() => assert.notEqual(s.obterCarrinhoAtivo(e.a.id).id, excluido));
  await esperar(async () => assert.equal(await e.page.getByRole('button', { name: 'Confirmar exclusão' }).count(), 0));
  const escolhido = s.obterCarrinhoAtivo(e.a.id).id;
  await e.page.reload();
  await e.page.getByRole('button', { name: /Ver carrinho/ }).click();
  await esperar(async () => assert.equal(await e.page.getByLabel('Carrinho ativo', { exact: true }).inputValue(), String(escolhido)));
  await e.page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await e.page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await esperar(() => assert.equal(s.obterCarrinhoAtivo(e.a.id).nome, 'Carrinho principal'));
  assert.equal(s.listarCarrinhos(e.a.id).length, 1);
});
test('adicao, remocao e limpeza no painel mantem vitrine utilizavel', async () => {
  await e.page.goto(e.base);
  await e.page.locator('article').filter({ has: e.page.getByRole('heading', { name: 'Filtro', exact: true }) }).getByRole('button', { name: 'Adicionar' }).click();
  await painel().getByText('Filtro', { exact: true }).waitFor();
  await e.page.locator('article').filter({ has: e.page.getByRole('heading', { name: 'Amortecedor', exact: true }) }).getByRole('button', { name: 'Adicionar' }).click();
  await painel().getByText('Amortecedor', { exact: true }).waitFor();
  assert.equal(new URL(e.page.url()).pathname, '/');
  await painel().getByRole('button', { name: 'Remover', exact: true }).first().click();
  await esperar(async () => assert.equal(await e.page.getByLabel('1 itens no carrinho').count(), 1));
  await e.page.getByRole('button', { name: 'Esvaziar', exact: true }).click();
  await e.page.getByRole('button', { name: 'Confirmar limpeza', exact: true }).click();
  await painel().getByText('Seu carrinho está vazio', { exact: true }).waitFor();
});
test('estoque parcial permite reduzir quantidade e retirar pendencia', async () => {
  e.semear([['FIL', 4]]); e.produtos.get('FIL').estoque = 2;
  await e.page.reload(); await e.page.getByRole('button', { name: /Ver carrinho/ }).click();
  await e.page.getByText('Restam apenas 2 em estoque.', { exact: true }).waitFor();
  assert.equal(await e.page.getByRole('button', { name: 'Fechar pedido' }).isDisabled(), true);
  await e.page.getByLabel('Quantidade de Filtro', { exact: true }).fill('2');
  await e.page.getByLabel('Quantidade de Filtro', { exact: true }).press('Enter');
  await esperar(async () => assert.equal(await e.page.getByRole('button', { name: 'Fechar pedido' }).isEnabled(), true));
  e.produtos.get('FIL').estoque = 200;
});
test('leitura atrasada de outro carrinho nao sobrescreve selecao nova', async () => {
  const atual = s.obterCarrinhoAtivo(e.a.id);
  const novo = s.criarCarrinho(e.a.id, 'Novo ativo');
  let liberar, recebeu, terminou;
  const barreira = new Promise(r => { liberar = r; });
  const recebida = new Promise(r => { recebeu = r; });
  const terminada = new Promise(r => { terminou = r; });
  let primeira = true;
  const handler = async route => {
    if (!primeira) return route.continue(); primeira = false;
    const resposta = await route.fetch(); recebeu(); await barreira;
    await route.fulfill({ response: resposta }); terminou();
  };
  await e.page.route('**/api/carrinho', handler);
  await e.page.reload(); await recebida;
  // Outra aba muda o ativo antes da leitura antiga terminar; uma inclusao nova
  // retorna o carrinho atual. A interface deve manter a resposta mais recente.
  s.ativarCarrinho(e.a.id, novo.id);
  await e.page.locator('article').filter({ has: e.page.getByRole('heading', { name: 'Amortecedor', exact: true }) }).getByRole('button', { name: 'Adicionar' }).click();
  await painel().getByText('Amortecedor', { exact: true }).waitFor();
  liberar(); await terminada;
  await esperar(async () => assert.equal(await e.page.getByLabel('Carrinho ativo', { exact: true }).inputValue(), String(novo.id)));
  assert.equal(await painel().getByText('Filtro', { exact: true }).count(), 0);
  assert.equal((await e.carrinho.lerCarrinho(e.a.id, e.db, atual.id)).quantidade_pecas, 2);
  await e.page.unroute('**/api/carrinho', handler);
});
for (const largura of [360, 390, 768, 1440]) test(`painel em ${largura}px: sem overflow e foco pelo teclado`, async () => {
  await e.page.setViewportSize({ width: largura, height: 900 });
  await e.page.goto(`${e.base}/?busca=amortecedor&categoria=TESTE`);
  await e.page.getByRole('button', { name: /Ver carrinho/ }).click();
  const painelAtual = largura < 1024 ? e.page.getByRole('dialog', { name: 'Meu carrinho' }) : painel();
  await painelAtual.waitFor();
  assert.equal(await e.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  const caixa = await painelAtual.boundingBox(); assert.ok(caixa.x >= 0 && caixa.x + caixa.width <= largura + 1);
  if (largura < 1024) {
    assert.equal(await painelAtual.evaluate(el => el.contains(document.activeElement)), true);
    for (let i = 0; i < 12; i++) {
      await e.page.keyboard.press('Tab');
      assert.equal(await painelAtual.evaluate(el => el.contains(document.activeElement) || document.activeElement === el), true);
    }
  }
  if (process.env.CAPTURAR_EVIDENCIAS === 'true')
    await e.page.screenshot({ path: await caminhoCaptura(`final-carrinho-${largura}.png`), fullPage: largura >= 1024 });
  const url = e.page.url();
  if (largura < 1024) await e.page.keyboard.press('Escape');
  else await e.page.getByRole('button', { name: 'Fechar painel' }).click();
  await esperar(async () => assert.equal(await painelAtual.isVisible(), false));
  assert.equal(e.page.url(), url);
  await esperar(async () => assert.equal(await e.page.getByRole('button', { name: /Ver carrinho/ }).evaluate(el => el === document.activeElement), true));
});
test('limite aparece no painel e falha de gerenciamento preserva selecao', async () => {
  await e.page.setViewportSize({ width: 1440, height: 900 });
  while (s.listarCarrinhos(e.a.id).length < 10) s.criarCarrinho(e.a.id, 'Reserva');
  await e.page.reload(); await e.page.getByRole('button', { name: /Ver carrinho/ }).click();
  await e.page.getByText('Limite de 10 carrinhos atingido.', { exact: true }).waitFor();
  assert.equal(await e.page.getByRole('button', { name: 'Novo carrinho' }).isDisabled(), true);
  const id = s.obterCarrinhoAtivo(e.a.id).id;
  await e.page.route('**/api/carrinhos/*/ativar', route => route.fulfill({ status: 502, json: { erro: { codigo: 'FALHA', mensagem: 'Falha de ativacao' } } }));
  const outro = s.listarCarrinhos(e.a.id).find(c => c.id !== id);
  await e.page.getByLabel('Carrinho ativo', { exact: true }).selectOption(String(outro.id));
  await e.page.getByRole('alert').filter({ hasText: 'Falha de ativacao' }).waitFor();
  assert.equal(s.obterCarrinhoAtivo(e.a.id).id, id);
  await e.page.unroute('**/api/carrinhos/*/ativar');
  assert.deepEqual(e.erros, []);
});
