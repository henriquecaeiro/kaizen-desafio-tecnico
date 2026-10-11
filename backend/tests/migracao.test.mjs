import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { aplicarSchema } from '../src/db/index.js';
const base = fs.readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf8');
const novoBanco = () => { const db = new Database(':memory:'); db.pragma('foreign_keys = ON'); return db; };
function usuario(db, id = 1) {
  db.prepare('INSERT INTO usuarios(id,nome,email,senha_hash,documento,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?)')
    .run(id, 'Teste', `${id}@example.test`, 'hash-ficticio', '00000000000', '2026-10-09', '2026-10-09');
}

test('banco novo e inicializacao repetida', () => {
  const db = novoBanco(); aplicarSchema(db); aplicarSchema(db);
  assert.equal(db.pragma('user_version', { simple: true }), 5);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM carrinhos').get().n, 0);
  assert.equal(db.pragma('integrity_check', { simple: true }), 'ok'); db.close();
});
for (const comItens of [true, false]) test(`banco antigo ${comItens ? 'com' : 'sem'} itens preserva contas e enderecos`, () => {
  const db = novoBanco(); db.exec(base); usuario(db); usuario(db, 2);
  db.prepare('INSERT INTO enderecos(usuario_id,apelido,cep,logradouro,numero,bairro,cidade,uf,criado_em,atualizado_em,principal) VALUES(?,?,?,?,?,?,?,?,?,?,1)')
    .run(1, 'Oficina', '01000000', 'Rua Teste', '1', 'Centro', 'Sao Paulo', 'SP', '2026-10-09', '2026-10-09');
  if (comItens) db.prepare('INSERT INTO carrinho_itens(usuario_id,codigo_produto,quantidade,adicionado_em) VALUES(?,?,?,?)').run(1, 'FIL', 7, '2026-10-09');
  const contas = db.prepare('SELECT * FROM usuarios').all(); const enderecos = db.prepare('SELECT * FROM enderecos').all();
  db.prepare('INSERT INTO pedidos_usuario(usuario_id,numero_erp,endereco_entrega,valor_total_centavos,criado_em) VALUES(?,?,?,?,?)').run(1, 'ANTIGO-1', '{"apelido":"Oficina"}', 115, '2026-10-09');
  const pedidos = db.prepare('SELECT * FROM pedidos_usuario').all();
  aplicarSchema(db); aplicarSchema(db);
  assert.deepEqual(db.prepare('SELECT * FROM usuarios').all(), contas);
  assert.deepEqual(db.prepare('SELECT * FROM enderecos').all(), enderecos);
  assert.deepEqual(db.prepare('SELECT * FROM pedidos_usuario').all(), pedidos);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM carrinhos').get().n, 2);
  const itens = db.prepare('SELECT i.*,c.usuario_id FROM carrinho_itens i JOIN carrinhos c ON c.id=i.carrinho_id').all();
  assert.equal(itens.length, comItens ? 1 : 0);
  if (comItens) { assert.equal(itens[0].quantidade, 7); assert.equal(itens[0].codigo_produto, 'FIL'); assert.equal(itens[0].usuario_id, 1); }
  db.prepare('DELETE FROM usuarios WHERE id=1').run();
  assert.equal(db.prepare('SELECT COUNT(*) n FROM carrinho_itens').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM enderecos').get().n, 0);
  assert.deepEqual(db.pragma('foreign_key_check'), []); db.close();
});
test('erro na migracao faz rollback sem perder dados antigos', () => {
  const db = novoBanco(); db.exec(base); usuario(db);
  db.pragma('foreign_keys = OFF');
  db.prepare('INSERT INTO carrinho_itens(usuario_id,codigo_produto,quantidade,adicionado_em) VALUES(?,?,?,?)').run(999, 'ORFAO', 3, '2026-10-09');
  db.pragma('foreign_keys = ON');
  assert.throws(() => aplicarSchema(db));
  assert.equal(db.pragma('user_version', { simple: true }), 0);
  assert.equal(db.prepare('SELECT quantidade FROM carrinho_itens').get().quantidade, 3);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='carrinhos'").get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM usuarios').get().n, 1); db.close();
});
test('indice impede dois carrinhos ativos para a mesma conta', () => {
  const db = novoBanco(); aplicarSchema(db); usuario(db);
  const inserir = db.prepare('INSERT INTO carrinhos(usuario_id,nome,ativo,criado_em,atualizado_em) VALUES(?,?,?,?,?)');
  inserir.run(1, 'A', 1, 'hoje', 'hoje');
  assert.throws(() => inserir.run(1, 'B', 1, 'hoje', 'hoje'), /UNIQUE/); db.close();
});
test('banco na versao 1 recebe apenas a migracao de tentativas', () => {
  const db = novoBanco(); db.exec(base); usuario(db);
  db.exec(fs.readFileSync(new URL('../src/db/migrations/001-multiple-carts.sql', import.meta.url), 'utf8'));
  db.pragma('user_version = 1');
  const antes = db.prepare('SELECT * FROM carrinhos').all();
  aplicarSchema(db); aplicarSchema(db);
  assert.deepEqual(db.prepare('SELECT * FROM carrinhos').all(), antes);
  assert.equal(db.pragma('user_version', { simple: true }), 5);
  db.close();
});
test('exclusao de usuario remove itens e tentativas sem orfaos', () => {
  const db = novoBanco(); aplicarSchema(db); usuario(db);
  db.prepare('INSERT INTO carrinhos(usuario_id,nome,ativo,criado_em,atualizado_em) VALUES(1,?,1,?,?)').run('A', 'hoje', 'hoje');
  db.prepare('INSERT INTO carrinho_itens(carrinho_id,codigo_produto,quantidade,adicionado_em) VALUES(1,?,1,?)').run('FIL', 'hoje');
  db.prepare("INSERT INTO checkout_tentativas(id,usuario_id,carrinho_id,assinatura,estado,criado_em,atualizado_em) VALUES('teste',1,1,'hash','VALIDANDO','hoje','hoje')").run();
  db.prepare('DELETE FROM usuarios WHERE id=1').run();
  for (const tabela of ['carrinhos', 'carrinho_itens', 'checkout_tentativas']) assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${tabela}`).get().n, 0);
  assert.deepEqual(db.pragma('foreign_key_check'), []); db.close();
});
