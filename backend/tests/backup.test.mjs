import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { prepararAmbiente } from '../test-support/ambiente.mjs';
import { criarBackup } from '../scripts/backup-db.mjs';
const e = await prepararAmbiente();
after(e.fechar);
const destino = path.join(path.dirname(e.db.name), 'backup.db');
test('backup online preserva dados confirmados no WAL, migracoes e integridade', async () => {
  e.semear([['FIL', 7]]);
  await e.carrinho.lerCarrinho(e.b.id);
  const cart = e.db.prepare('SELECT id FROM carrinhos WHERE usuario_id=? AND ativo=1').get(e.a.id);
  assert.equal(e.db.pragma('journal_mode', { simple: true }), 'wal');
  await criarBackup(e.db.name, destino);
  const copia = new Database(destino, { readonly: true });
  try {
    assert.equal(copia.pragma('integrity_check', { simple: true }), 'ok');
    assert.deepEqual(copia.pragma('foreign_key_check'), []);
    assert.equal(copia.pragma('user_version', { simple: true }), 5);
    assert.equal(copia.prepare('SELECT quantidade FROM carrinho_itens WHERE carrinho_id=?').get(cart.id).quantidade, 7);
    assert.equal(copia.prepare('SELECT COUNT(*) n FROM usuarios').get().n, 2);
    assert.equal(fs.statSync(destino).mode & 0o777, 0o600);
  } finally { copia.close(); }
});
test('backup nao sobrescreve arquivo existente nem o banco original', async () => {
  const antes = fs.readFileSync(destino);
  await assert.rejects(criarBackup(e.db.name, destino), /arquivo novo/);
  assert.deepEqual(fs.readFileSync(destino), antes);
  await assert.rejects(criarBackup(e.db.name, e.db.name), /arquivo novo/);
  assert.equal(e.db.pragma('integrity_check', { simple: true }), 'ok');
});
test('origem ausente e backup incompleto nao sao anunciados como sucesso', async () => {
  const inexistente = path.join(path.dirname(e.db.name), 'ausente.db');
  await assert.rejects(criarBackup(inexistente, path.join(path.dirname(e.db.name), 'outro.db')));
  assert.equal(fs.existsSync(inexistente), false);
  const invalido = path.join(path.dirname(e.db.name), 'invalido.db');
  await assert.rejects(criarBackup(path.dirname(e.db.name), invalido));
  assert.equal(fs.existsSync(`${invalido}.parcial`), false);
  assert.equal(fs.existsSync(`${destino}.parcial`), false);
});
test('restauracao em novo caminho preserva selecao, itens e enderecos', () => {
  const restaurado = path.join(path.dirname(e.db.name), 'restaurado.db');
  fs.copyFileSync(destino, restaurado, fs.constants.COPYFILE_EXCL);
  const db = new Database(restaurado); db.pragma('foreign_keys=ON');
  try {
    assert.equal(db.prepare('SELECT COUNT(*) n FROM carrinhos WHERE ativo=1').get().n, 2);
    assert.equal(db.prepare('SELECT SUM(quantidade) n FROM carrinho_itens').get().n, 7);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM enderecos').get().n, 3);
    assert.deepEqual(db.pragma('foreign_key_check'), []);
  } finally { db.close(); }
});
