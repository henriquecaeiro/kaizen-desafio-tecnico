import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, esperar } from './navegador.mjs';
const e = await abrirNavegador();
after(e.fechar);

test('jornada completa: catálogo, conta, dois carrinhos, dois endereços, checkout mock e isolamento', async () => {
  for (let i = 0; i < 30; i++) e.produtos.set(`EXTRA-${i}`, { ...e.produtos.get('FIL'), codigo: `EXTRA-${i}`, descricao: `Filtro extra ${i}` });
  await e.page.goto(e.base);
  await e.page.getByRole('button', { name: 'Próxima', exact: true }).click();
  assert.equal(new URL(e.page.url()).searchParams.get('pagina'), '2');
  await e.page.getByLabel('Buscar peças').fill('amortecedor'); await e.page.getByLabel('Buscar peças').press('Enter');
  await e.page.getByRole('heading', { name: 'Amortecedor', exact: true }).waitFor();
  assert.equal(new URL(e.page.url()).searchParams.has('pagina'), false);
  await e.page.getByRole('button', { name: 'teste', exact: true }).click();
  await e.page.getByLabel('Só com estoque').click();
  await esperar(async () => assert.equal(await e.page.getByLabel('Só com estoque').isChecked(), true));
  await e.page.goto(e.base + '/cadastro');
  for (const [label, valor] of [['Nome completo', 'Oficina fictícia'], ['E-mail', 'jornada@example.test'],
    ['CPF ou CNPJ', '12345678901'], ['Telefone (opcional)', '11987654321'], ['Senha', 'Jornada@123'], ['Confirmar senha', 'Jornada@123']])
    await e.page.getByLabel(label, { exact: true }).fill(valor);
  await e.page.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
  await e.page.getByRole('button', { name: 'Ocultar senha', exact: true }).click();
  await e.page.getByRole('button', { name: 'Criar conta', exact: true }).click(); await e.page.waitForURL(e.base + '/');
  const conta = e.db.prepare('SELECT id FROM usuarios WHERE email=?').get('jornada@example.test').id;
  await e.page.getByRole('button', { name: 'Sair', exact: true }).click();
  await e.page.goto(e.base + '/entrar');
  await e.page.getByLabel('E-mail', { exact: true }).fill('jornada@example.test');
  await e.page.getByLabel('Senha', { exact: true }).fill('Jornada@123');
  await e.page.getByRole('button', { name: 'Entrar', exact: true }).click(); await e.page.waitForURL(e.base + '/');
  await e.page.getByRole('button', { name: 'Ver carrinho (0)' }).click();
  async function criar(nome) {
    await e.page.getByRole('button', { name: 'Novo carrinho', exact: true }).click();
    await e.page.getByLabel('Nome do carrinho', { exact: true }).fill(nome);
    await e.page.getByRole('button', { name: 'Salvar carrinho', exact: true }).click();
    await esperar(async () => assert.equal(await e.page.getByLabel('Nome do carrinho', { exact: true }).count(), 0));
    return Number(await e.page.getByLabel('Carrinho ativo', { exact: true }).inputValue());
  }
  const gol = await criar('Gol');
  const card = nome => e.page.locator('article').filter({ has: e.page.getByRole('heading', { name: nome, exact: true }) });
  await card('Filtro').getByRole('button', { name: 'Adicionar', exact: true }).click();
  const quantidade = e.page.getByLabel('Quantidade de Filtro', { exact: true });
  await quantidade.fill(''); await quantidade.fill('3'); await quantidade.press('Enter');
  await esperar(async () => assert.equal(await e.page.getByLabel('3 itens no carrinho', { exact: true }).count(), 1));
  await quantidade.press('ArrowUp'); await quantidade.press('Tab');
  await esperar(async () => assert.equal(await e.page.getByLabel('4 itens no carrinho', { exact: true }).count(), 1));
  const civic = await criar('Civic');
  await card('Amortecedor').getByRole('button', { name: 'Adicionar', exact: true }).click();
  await e.page.getByLabel('Quantidade de Amortecedor', { exact: true }).waitFor();
  await e.page.getByRole('button', { name: 'Renomear', exact: true }).click();
  await e.page.getByLabel('Nome do carrinho', { exact: true }).fill('Civic prata');
  await e.page.getByRole('button', { name: 'Salvar carrinho', exact: true }).click();
  await esperar(async () => assert.equal(await e.page.getByLabel('Nome do carrinho', { exact: true }).count(), 0));
  await e.page.getByLabel('Carrinho ativo', { exact: true }).selectOption(String(gol));
  await quantidade.waitFor(); assert.equal(await quantidade.inputValue(), '4');
  await e.page.reload(); await e.page.getByRole('button', { name: 'Ver carrinho (4)' }).click();
  await quantidade.waitFor(); assert.equal(await quantidade.inputValue(), '4');
  const temporario = await criar('Descartável');
  await e.page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await e.page.getByRole('button', { name: 'Confirmar exclusão', exact: true }).click();
  await esperar(() => assert.equal(e.db.prepare('SELECT id FROM carrinhos WHERE id=?').get(temporario), undefined));
  await e.page.goto(e.base + '/perfil');
  async function endereco(apelido, cep) {
    await e.page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    for (const [label, valor] of [['Apelido', apelido], ['CEP', cep], ['Logradouro', `Rua ${apelido}`],
      ['Número', '10'], ['Bairro', 'Centro'], ['Cidade', 'São Paulo'], ['UF', 'SP']])
      await e.page.getByLabel(label, { exact: true }).fill(valor);
    assert.equal(await e.page.getByLabel('CEP', { exact: true }).inputValue(), cep.slice(0, 5) + '-' + cep.slice(5));
    await e.page.getByRole('button', { name: 'Adicionar endereço', exact: true }).click();
    await e.page.getByRole('listitem').filter({ hasText: apelido }).getByRole('button', { name: 'Editar', exact: true }).waitFor();
  }
  await endereco('Casa fictícia', '01000000'); await endereco('Oficina fictícia', '01310100');
  await e.page.goto(e.base + '/carrinho');
  await e.page.getByLabel('Carrinho ativo', { exact: true }).selectOption(String(gol));
  await quantidade.waitFor(); await e.page.getByRole('button', { name: 'Fechar pedido', exact: true }).click();
  const oficina = e.db.prepare('SELECT id FROM enderecos WHERE usuario_id=? AND apelido=?').get(conta, 'Oficina fictícia').id;
  await e.page.locator(`input[type="radio"][value="${oficina}"]`).check();
  await e.page.getByRole('button', { name: 'Confirmar pedido', exact: true }).click();
  await e.page.waitForURL(/\/pedidos\/MOCK-/);
  assert.match(e.pedidos.at(-1).observacao, /Rua Oficina fictícia/);
  assert.equal((await e.carrinho.lerCarrinho(conta, e.db, civic)).quantidade_pecas, 1);
  assert.equal((await e.carrinho.lerCarrinho(conta, e.db, gol)).quantidade_pecas, 0);
  await e.page.getByRole('button', { name: 'Sair', exact: true }).click(); await e.entrar('b');
  await e.page.goto(e.base + '/carrinho'); await e.page.getByText('Seu carrinho está vazio', { exact: true }).waitFor();
  assert.equal(await e.page.getByText('Civic prata', { exact: false }).count(), 0);
  for (const largura of [360, 390, 768, 1440]) {
    await e.page.setViewportSize({ width: largura, height: 900 });
    await e.page.goto(e.base + '/cadastro');
    await e.page.getByLabel('Telefone (opcional)', { exact: true }).fill('11987654321');
    assert.equal(await e.page.getByLabel('Telefone (opcional)', { exact: true }).getAttribute('inputmode'), 'numeric');
    await e.page.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
    assert.equal(await e.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  assert.deepEqual(e.erros, []);
});
