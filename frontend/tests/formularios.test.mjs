import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, esperar } from './navegador.mjs';

const e = await abrirNavegador();
after(e.fechar);
test('cadastro: máscaras, confirmação vazia/diferente, visibilidade, falha e sucesso com espaços', async () => {
  await e.page.goto(e.base + '/cadastro');
  const documento = e.page.getByLabel('CPF ou CNPJ', { exact: true });
  await documento.pressSequentially('12345678901');
  assert.equal(await documento.inputValue(), '123.456.789-01');
  await documento.fill('12.345.678/0001-90');
  assert.equal(await documento.inputValue(), '12.345.678/0001-90');
  await documento.fill(''); await documento.pressSequentially('12345678901');
  await documento.press('ArrowLeft'); await documento.press('Backspace');
  assert.equal((await documento.inputValue()).replace(/\D/g, '').length, 10);
  await documento.fill('12345678901');
  await documento.evaluate(el => el.setSelectionRange(4, 4)); await documento.press('Backspace');
  assert.equal((await documento.inputValue()).replace(/\D/g, ''), '1245678901');
  await documento.fill('12345678901');
  await documento.evaluate(el => el.setSelectionRange(3, 3)); await documento.press('Delete');
  assert.equal((await documento.inputValue()).replace(/\D/g, ''), '1235678901');
  await documento.fill('12345678901');
  const telefone = e.page.getByLabel('Telefone (opcional)', { exact: true });
  await telefone.fill('1133334444'); assert.equal(await telefone.inputValue(), '(11) 3333-4444');
  await telefone.fill('11987654321'); assert.equal(await telefone.inputValue(), '(11) 98765-4321');
  assert.equal(await telefone.getAttribute('inputmode'), 'numeric');
  const senha = e.page.getByLabel('Senha', { exact: true });
  await e.page.getByLabel('Nome completo').fill('Conta de teste');
  await e.page.getByLabel('E-mail', { exact: true }).fill('nova@example.test');
  const original = '  Senha@Nova123!  ';
  await senha.fill(original); assert.equal(await senha.getAttribute('type'), 'password');
  await e.page.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
  assert.equal(await senha.getAttribute('type'), 'text'); assert.equal(await senha.inputValue(), original);
  await e.page.getByRole('button', { name: 'Ocultar senha', exact: true }).press('Enter');
  assert.equal(await senha.getAttribute('type'), 'password');
  let chamadas = 0, payload;
  const handler = route => {
    chamadas++; payload = route.request().postDataJSON();
    return route.fulfill({ status: 503, json: { erro: { codigo: 'FALHA', mensagem: 'Falha simulada de cadastro' } } });
  };
  await e.page.route('**/api/auth/cadastro', handler);
  try {
    await e.page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await e.page.getByText('As senhas precisam coincidir.', { exact: true }).waitFor();
    await e.page.getByLabel('Confirmar senha', { exact: true }).fill('Diferente123');
    await e.page.getByRole('button', { name: 'Criar conta', exact: true }).click(); assert.equal(chamadas, 0);
    await e.page.getByLabel('Confirmar senha', { exact: true }).fill(original);
    await e.page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await e.page.getByRole('alert').filter({ hasText: 'Falha simulada de cadastro' }).waitFor();
    assert.equal(payload.senha, original); assert.equal(Object.hasOwn(payload, 'confirmarSenha'), false);
    assert.equal(await senha.inputValue(), original);
  } finally { await e.page.unroute('**/api/auth/cadastro', handler); }
  await e.page.getByRole('button', { name: 'Criar conta', exact: true }).click(); await e.page.waitForURL(e.base + '/');
  await e.page.getByRole('button', { name: 'Sair', exact: true }).click();
  await e.page.goto(e.base + '/entrar');
  await e.page.getByLabel('E-mail', { exact: true }).fill('nova@example.test');
  await e.page.getByLabel('Senha', { exact: true }).fill(original);
  await e.page.getByRole('button', { name: 'Mostrar senha', exact: true }).click();
  await e.page.getByRole('button', { name: 'Entrar', exact: true }).click(); await e.page.waitForURL(e.base + '/');
});
test('perfil: formata dados antigos e CEP na criação/edição; confirmação protege troca de senha', async () => {
  await e.entrar(); await e.page.goto(e.base + '/perfil');
  assert.equal(await e.page.getByLabel('CPF ou CNPJ').inputValue(), '000.000.000-00');
  await e.page.getByLabel('Telefone', { exact: true }).fill('11987654321');
  await e.page.getByRole('button', { name: 'Salvar dados' }).click(); await e.page.getByText('Dados atualizados.').waitFor();
  assert.equal(e.db.prepare('SELECT telefone FROM usuarios WHERE id=?').get(e.a.id).telefone, '11987654321');
  await e.page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await e.page.getByLabel('Apelido', { exact: true }).fill('Novo');
  await e.page.getByLabel('CEP', { exact: true }).fill('01310100');
  assert.equal(await e.page.getByLabel('CEP', { exact: true }).inputValue(), '01310-100');
  for (const [label, valor] of [['Logradouro', 'Rua teste'], ['Número', '1'], ['Bairro', 'Centro'], ['Cidade', 'São Paulo'], ['UF', 'SP']])
    await e.page.getByLabel(label, { exact: true }).fill(valor);
  await e.page.getByRole('button', { name: 'Adicionar endereço', exact: true }).click();
  await e.page.getByText('Novo', { exact: true }).waitFor();
  await e.page.getByRole('listitem').filter({ hasText: 'Novo' }).getByRole('button', { name: 'Editar', exact: true }).click();
  assert.equal(await e.page.getByLabel('CEP', { exact: true }).inputValue(), '01310-100');
  await e.page.getByLabel('CEP', { exact: true }).fill('');
  await e.page.getByLabel('CEP', { exact: true }).pressSequentially('01000000');
  await e.page.getByRole('button', { name: 'Salvar alterações', exact: true }).click(); await e.page.getByText('Novo', { exact: true }).waitFor();
  const antiga = await e.page.context().cookies();
  await e.page.getByLabel('Senha atual', { exact: true }).fill('TesteLocal123');
  await e.page.getByLabel('Nova senha', { exact: true }).fill('  Nova@Senha123  ');
  await e.page.getByRole('button', { name: 'Trocar senha', exact: true }).click();
  await e.page.getByText('As senhas precisam coincidir.').waitFor();
  await e.page.getByLabel('Confirmar nova senha', { exact: true }).fill('  Nova@Senha123  ');
  await e.page.getByLabel('Senha atual', { exact: true }).fill('Incorreta123');
  await e.page.getByRole('button', { name: 'Trocar senha', exact: true }).click();
  await esperar(async () => assert.equal(await e.page.getByLabel('Senha atual', { exact: true }).getAttribute('aria-invalid'), 'true'));
  await e.page.getByLabel('Senha atual', { exact: true }).fill('TesteLocal123');
  await e.page.getByRole('button', { name: 'Trocar senha', exact: true }).click(); await e.page.getByText('Senha alterada.').waitFor();
  assert.equal((await e.chamada('/auth/eu', { cookie: antiga.map(c => `${c.name}=${c.value}`).join('; ') })).status, 401);
  assert.deepEqual(e.erros, []);
});

test('colar pelo clipboard, selecionar tudo e substituir preservam máscara e senha', async () => {
  await e.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: e.base });
  await e.page.goto(e.base + '/cadastro');
  const campo = e.page.getByLabel('CPF ou CNPJ', { exact: true });
  for (const valor of ['12345678901', '123.456.789-01', '12345678000190']) {
    await e.page.evaluate(texto => navigator.clipboard.writeText(texto), valor);
    await campo.focus(); await campo.press('Control+A'); await campo.press('Control+V');
    assert.equal(await campo.inputValue(), valor.includes('0001') ? '12.345.678/0001-90' : '123.456.789-01');
  }
  await campo.press('Control+A'); await campo.press('Backspace'); assert.equal(await campo.inputValue(), '');
  await e.page.evaluate(() => navigator.clipboard.writeText('  Senha@Com espaços123!  '));
  const senha = e.page.getByLabel('Senha', { exact: true });
  await senha.focus(); await senha.press('Control+V');
  assert.equal(await senha.inputValue(), '  Senha@Com espaços123!  ');
});
