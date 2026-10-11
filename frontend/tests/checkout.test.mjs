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
