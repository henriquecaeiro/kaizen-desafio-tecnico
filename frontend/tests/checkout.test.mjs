import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador } from './navegador.mjs';
let e;
before(async () => { e = await abrirNavegador(); });
after(async () => { await e?.fechar(); });

test('endereco principal e apenas inicial; secundario segue no payload e snapshot', async () => {
  e.semear([['FIL', 2]]); await e.entrar();
  await e.page.goto(`${e.base}/checkout`);
  const radios = e.page.getByRole('radio');
  await radios.first().waitFor(); assert.equal(await radios.first().isChecked(), true);
  await radios.nth(1).check();
  await e.page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await e.page.waitForURL(/\/pedidos\/MOCK-/);
  assert.match(e.pedidos.at(-1).observacao, /Rua Oficina/);
  const snapshot = JSON.parse(e.db.prepare('SELECT endereco_entrega FROM pedidos_usuario ORDER BY id DESC LIMIT 1').get().endereco_entrega);
  assert.equal(snapshot.id, e.oficina.id);
  assert.deepEqual(e.erros, []);
});
test('endereco removido em outra aba mostra erro e preserva carrinho', async () => {
  e.semear([['FIL', 1]]);
  await e.page.goto(`${e.base}/checkout`);
  await e.page.getByRole('radio').nth(1).check();
  e.enderecos.removerEndereco(e.a.id, e.oficina.id);
  const total = e.pedidos.length;
  await e.page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await e.page.getByText('Endereco de entrega nao encontrado.', { exact: false }).waitFor();
  assert.equal(e.pedidos.length, total);
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).quantidade_pecas, 1);
});

test('endereco criado no checkout fica selecionado e e enviado ao ERP', async () => {
  await e.page.goto(`${e.base}/checkout`);
  await e.page.getByRole('button', { name: 'Adicionar outro' }).click();
  for (const [rotulo, valor] of [['Apelido', 'Nova oficina'], ['CEP', '01000000'], ['Logradouro', 'Rua Nova'], ['Número', '20'], ['Bairro', 'Centro'], ['Cidade', 'Sao Paulo'], ['UF', 'SP']]) {
    await e.page.getByRole('textbox', { name: rotulo, exact: false }).fill(valor);
  }
  await e.page.getByRole('button', { name: 'Adicionar endereço', exact: true }).click();
  await e.page.getByRole('radio').nth(1).waitFor();
  e.controle.recusar = true;
  await e.page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await e.page.getByText('Estoque mudou', { exact: true }).waitFor();
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).quantidade_pecas, 1);
  e.controle.recusar = false;
  await e.page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await e.page.waitForURL(/\/pedidos\/MOCK-/);
  assert.match(e.pedidos.at(-1).observacao, /Rua Nova/);
});

test('checkout do ativo preserva itens de outro carrinho na interface', async () => {
  const s = await import('../../backend/src/services/carrinhosService.js');
  const primeiro = s.obterCarrinhoAtivo(e.a.id);
  e.semear([['FIL', 3]]);
  const novo = s.criarCarrinho(e.a.id, 'Pedido separado'); s.ativarCarrinho(e.a.id, novo.id);
  e.semear([['SUS', 2]]);
  await e.page.goto(`${e.base}/checkout`);
  await e.page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await e.page.waitForURL(/\/pedidos\/MOCK-/);
  assert.deepEqual(e.pedidos.at(-1).itens.map(i => i.codigo_produto), ['SUS']);
  await e.page.getByRole('link', { name: 'Carrinho', exact: true }).click();
  await e.page.getByText('Seu carrinho está vazio', { exact: true }).waitFor();
  await e.page.getByLabel('Carrinho ativo', { exact: true }).selectOption(String(primeiro.id));
  await e.page.getByText('Filtro', { exact: true }).waitFor();
  assert.equal(await e.page.getByLabel('3 itens no carrinho').count(), 1);
});
test('checkout incerto informa conferência e desabilita nova compra', async () => {
  let liberar; e.controle.barreira = new Promise(r => { liberar = r; });
  await e.page.goto(`${e.base}/checkout`);
  await e.page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await e.page.getByRole('alert').filter({ hasText: 'O resultado do pedido precisa ser conferido pela loja' }).waitFor();
  assert.equal(await e.page.getByRole('button', { name: 'Confirmar pedido' }).isDisabled(), true);
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).quantidade_pecas, 3);
  liberar(); e.controle.barreira = null;
  assert.deepEqual(e.erros, []);
});
