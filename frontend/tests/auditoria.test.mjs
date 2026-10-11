import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { abrirNavegador, esperar } from './navegador.mjs';
import { problemasDeContraste } from './contraste.mjs';
const e = await abrirNavegador();
after(e.fechar);
e.semear([['FIL', 1]]);
const pedido = await e.pedido.finalizarPedido(e.a, e.oficina.id, 'Auditoria mock');
e.semear([['FIL', 3], ['SUS', 4]]);

test('listagem se recupera de erro com retry, sem refresh', async () => {
  await e.entrar();
  let falhar = true;
  await e.page.route('**/api/pedidos?*', route => falhar ? route.fulfill({ status: 502,
    json: { erro: { codigo: 'ERP_INDISPONIVEL', mensagem: 'Falha de teste da lista' } } }) : route.continue());
  try {
    await e.page.goto(`${e.base}/pedidos`);
    await e.page.getByRole('alert').waitFor(); falhar = false;
    await e.page.getByRole('button', { name: 'Tentar novamente' }).click();
    await e.page.getByRole('link', { name: new RegExp(pedido.numero) }).waitFor();
    assert.equal(await e.page.getByRole('alert').count(), 0);
  } finally { await e.page.unroute('**/api/pedidos?*'); }
});
test('detalhe distingue indisponibilidade de 404 e permite repetir leitura', async () => {
  e.controle.respostas.set(`GET /pedidos/${pedido.numero}`, { status: 503, json: {} });
  await e.page.goto(`${e.base}/pedidos/${pedido.numero}`);
  await e.page.getByText('Não foi possível carregar o pedido').waitFor();
  assert.equal(await e.page.getByText('Pedido não encontrado', { exact: true }).count(), 0);
  e.controle.respostas.clear();
  await e.page.getByRole('button', { name: 'Tentar novamente' }).click();
  await e.page.getByRole('heading', { name: pedido.numero }).waitFor();
  assert.equal(await e.page.getByRole('alert').count(), 0);
});
test('historico mostra dados locais e aviso de status indisponivel; retry recupera', async () => {
  e.controle.respostas.set(`GET /pedidos/${pedido.numero}`, { raw: 'invalido' });
  await e.page.goto(`${e.base}/pedidos`);
  await e.page.getByText('Status temporariamente indisponível').waitFor();
  await e.page.getByText('status indisponível', { exact: true }).waitFor();
  e.controle.respostas.clear();
  await e.page.getByRole('button', { name: 'Tentar novamente' }).click();
  await e.page.getByText('aberto', { exact: true }).waitFor();
});
test('perfil limpa telefone e troca senha mantendo novo cookie e revogando o antigo', async () => {
  await e.page.goto(`${e.base}/perfil`);
  await e.page.getByLabel('Telefone', { exact: true }).fill('11999998888');
  await e.page.getByRole('button', { name: 'Salvar dados' }).click();
  await e.page.getByText('Dados atualizados.').waitFor();
  await e.page.getByLabel('Telefone', { exact: true }).fill('');
  await e.page.getByRole('button', { name: 'Salvar dados' }).click();
  await esperar(() => assert.equal(e.db.prepare('SELECT telefone FROM usuarios WHERE id=?').get(e.a.id).telefone, null));
  const antigo = (await e.context.cookies()).find(c => c.name === 'kaizen_sessao').value;
  await e.page.getByLabel('Senha atual', { exact: true }).fill('TesteLocal123');
  await e.page.getByLabel('Nova senha', { exact: true }).fill('  SenhaNovaＡ123  ');
  await e.page.getByRole('button', { name: 'Trocar senha', exact: true }).click();
  await e.page.getByText('Senha alterada.', { exact: true }).waitFor();
  assert.equal((await e.chamada('/auth/eu', { cookie: `kaizen_sessao=${antigo}` })).status, 401);
  await e.page.reload();
  await e.page.getByRole('heading', { name: 'Minha conta' }).waitFor();
});
test('erro de formulario tem label, aria-invalid e descricao vinculada', async () => {
  await e.page.goto(`${e.base}/perfil`);
  await e.page.getByLabel('Nome completo').fill('');
  await e.page.getByRole('button', { name: 'Salvar dados' }).click();
  await esperar(async () => assert.equal(await e.page.getByLabel('Nome completo').getAttribute('aria-invalid'), 'true'));
  assert.equal(await e.page.getByLabel('Nome completo').getAttribute('aria-describedby'), 'nome-erro');
  assert.equal(await e.page.locator('#nome-erro').innerText(), 'Campo obrigatorio.');
  assert.equal(await e.page.getByLabel('Nova senha').getAttribute('aria-describedby'), 'nova_senha-dica');
});

test('atalho de teclado pula para o conteudo e foco permanece visivel', async () => {
  await e.page.goto(`${e.base}/`);
  await e.page.keyboard.press('Tab');
  assert.equal(await e.page.evaluate(() => document.activeElement.textContent.trim()), 'Pular para o conteúdo');
  await e.page.keyboard.press('Enter');
  assert.equal(await e.page.evaluate(() => document.activeElement.id), 'conteudo');
});

for (const largura of [360, 390, 768, 1440]) test(`telas principais em ${largura}px: sem overflow, labels e botoes acessiveis`, async () => {
  await e.page.setViewportSize({ width: largura, height: 900 });
  for (const [rota, pronto] of [
    ['/', 'Peças para'], ['/produto/FIL', 'Filtro'], ['/produto/RAD', 'Radiador'],
    ['/carrinho', 'Carrinho'], ['/checkout', 'Endereço de entrega'], ['/perfil', 'Minha conta'],
    ['/pedidos', 'Meus pedidos'], [`/pedidos/${pedido.numero}`, pedido.numero],
    ['/entrar', 'Entrar'], ['/cadastro', 'Criar conta'],
  ]) {
    await e.page.goto(`${e.base}${rota}`);
    await e.page.locator('main').getByText(pronto, { exact: false }).first().waitFor();
    await esperar(async () => assert.equal(await e.page.locator('main').getByText(/Carregando/).count(), 0));
    const problemas = await e.page.evaluate(() => {
      const visivel = el => el.getClientRects().length > 0;
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        semNome: [...document.querySelectorAll('button')].filter(visivel).filter(el => !el.textContent.trim() && !el.getAttribute('aria-label')).length,
        semLabel: [...document.querySelectorAll('input,select,textarea')].filter(visivel).filter(el => !el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')).length,
        pequenos: [...document.querySelectorAll('button')].filter(visivel).filter(el => el.getBoundingClientRect().height < 24).length,
      };
    });
    assert.deepEqual(problemas, { overflow: false, semNome: 0, semLabel: 0, pequenos: 0 }, `${rota} em ${largura}px`);
    assert.deepEqual(await problemasDeContraste(e.page), [], `contraste ${rota} em ${largura}px`);
  }
  await e.page.goto(`${e.base}/produto/FIL`);
  await e.page.getByRole('heading', { name: 'Filtro', exact: true }).waitFor();
  await e.page.screenshot({ path: fileURLToPath(new URL(`../../docs/evidencias/final-produto-${largura}.png`, import.meta.url)), fullPage: true });
  assert.deepEqual(e.erros, []);
});
