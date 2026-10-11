import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import { prepararAmbiente } from '../test-support/ambiente.mjs';
const e = await prepararAmbiente();
after(e.fechar);
const principais = id => e.enderecos.listarEnderecos(id).filter(endereco => endereco.principal);

test('primeiro endereco e principal; criar outro nao muda a selecao, salvo principal explicito', () => {
  assert.deepEqual(principais(e.b.id).map(p => p.id), [e.enderecoB.id]);
  e.enderecos.criarEndereco(e.b.id, e.endereco('Segundo'));
  assert.deepEqual(principais(e.b.id).map(p => p.id), [e.enderecoB.id]);
  const terceiro = e.enderecos.criarEndereco(e.b.id, { ...e.endereco('Terceiro'), principal: true });
  assert.deepEqual(principais(e.b.id).map(p => p.id), [terceiro.id]);
});
test('editar principal sem mudar selecao preserva; desmarcar promove outro', () => {
  e.enderecos.atualizarEndereco(e.a.id, e.casa.id, { numero: '20' });
  assert.deepEqual(principais(e.a.id).map(p => p.id), [e.casa.id]);
  e.enderecos.atualizarEndereco(e.a.id, e.casa.id, { principal: false });
  assert.deepEqual(principais(e.a.id).map(p => p.id), [e.oficina.id]);
  e.enderecos.atualizarEndereco(e.a.id, e.casa.id, { principal: true });
  assert.deepEqual(principais(e.a.id).map(p => p.id), [e.casa.id]);
});
test('excluir principal promove mais antigo; unico nao pode ser desmarcado', () => {
  e.enderecos.removerEndereco(e.a.id, e.casa.id);
  assert.deepEqual(principais(e.a.id).map(p => p.id), [e.oficina.id]);
  const unico = e.enderecos.atualizarEndereco(e.a.id, e.oficina.id, { principal: false });
  assert.equal(unico.principal, true);
  e.enderecos.removerEndereco(e.a.id, e.oficina.id);
  assert.equal(e.enderecos.listarEnderecos(e.a.id).length, 0);
  assert.equal(e.enderecos.criarEndereco(e.a.id, e.endereco('Novo')).principal, true);
});
test('indice unico e transacao impedem dois principais e revertem falha de edicao', () => {
  const atual = principais(e.a.id)[0];
  const segundo = e.enderecos.criarEndereco(e.a.id, e.endereco('Outro'));
  assert.throws(() => e.db.prepare('UPDATE enderecos SET principal=1 WHERE id=?').run(segundo.id), /UNIQUE/);
  e.db.exec(`CREATE TRIGGER falha_endereco BEFORE UPDATE OF numero ON enderecos
    WHEN NEW.numero='falhar' BEGIN SELECT RAISE(ABORT,'falha simulada'); END;`);
  try {
    assert.throws(() => e.enderecos.atualizarEndereco(e.a.id, segundo.id, { principal: true, numero: 'falhar' }));
    assert.deepEqual(principais(e.a.id).map(p => p.id), [atual.id]);
  } finally { e.db.exec('DROP TRIGGER falha_endereco'); }
});
test('API rejeita endereco alheio em edicao/exclusao e preserva principal', async () => {
  const cookie = await e.login();
  const atual = principais(e.a.id)[0];
  const editado = await e.chamada(`/enderecos/${atual.id}`, { metodo: 'PUT', cookie, corpo: e.endereco('Editado') });
  assert.equal(editado.status, 200); assert.equal(editado.json.dados.principal, true);
  for (const metodo of ['PUT', 'DELETE']) {
    const r = await e.chamada(`/enderecos/${e.enderecoB.id}`, { metodo, cookie,
      ...(metodo === 'PUT' ? { corpo: { ...e.endereco('Alheio'), principal: true } } : {}) });
    assert.equal(r.status, 404);
  }
  assert.equal(principais(e.b.id).length, 1);
});
test('telefone aceita preenchimento, substituicao, vazio e null; omitido nao altera', async () => {
  const cookie = await e.login();
  for (const [corpo, esperado] of [
    [{ telefone: '11999998888' }, '11999998888'],
    [{ nome: 'Nome atualizado' }, '11999998888'],
    [{ telefone: '1122223333' }, '1122223333'],
    [{ telefone: '' }, null], [{ telefone: '11999998888' }, '11999998888'], [{ telefone: null }, null],
  ]) {
    const r = await e.chamada('/perfil', { metodo: 'PATCH', cookie, corpo });
    assert.equal(r.status, 200); assert.equal(r.json.dados.telefone, esperado);
    assert.equal(r.json.dados.documento, e.a.documento);
    assert.equal(Object.hasOwn(r.json.dados, 'senha_hash'), false);
  }
  for (const corpo of [{ nome: null }, { documento: '' }, { telefone: '123' }]) {
    assert.equal((await e.chamada('/perfil', { metodo: 'PATCH', cookie, corpo })).status, 422);
  }
});
test('migracao repara selecao ausente ou duplicada sem alterar conteudo ou datas', async () => {
  const db = new Database(':memory:'); db.pragma('foreign_keys=ON');
  db.exec(fs.readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf8'));
  for (const id of [1, 2]) db.prepare(`INSERT INTO usuarios(id,nome,email,senha_hash,documento,criado_em,atualizado_em)
    VALUES(?,'Teste',?,'hash','00000000000','hoje','hoje')`).run(id, `${id}@example.test`);
  for (const [usuario, principal] of [[1, 0], [1, 0], [2, 1], [2, 1]]) {
    db.prepare(`INSERT INTO enderecos(usuario_id,apelido,cep,logradouro,numero,bairro,cidade,uf,principal,criado_em,atualizado_em)
      VALUES(?,'Casa','01000000','Rua','10','Centro','Sao Paulo','SP',?,'hoje','hoje')`).run(usuario, principal);
  }
  const semSelecao = linhas => linhas.map(({ principal, ...resto }) => resto);
  const antes = semSelecao(db.prepare('SELECT * FROM enderecos').all());
  const { aplicarSchema } = await import('../src/db/index.js'); aplicarSchema(db); aplicarSchema(db);
  assert.deepEqual(semSelecao(db.prepare('SELECT * FROM enderecos').all()), antes);
  assert.deepEqual(db.prepare('SELECT id FROM enderecos WHERE principal=1 ORDER BY id').all(), [{ id: 1 }, { id: 3 }]);
  assert.throws(() => db.prepare('UPDATE enderecos SET principal=1 WHERE id=2').run(), /UNIQUE/);
  db.close();
});
