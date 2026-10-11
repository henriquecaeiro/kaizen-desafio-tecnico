import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';

let instancia = null;

export function obterBanco() {
  if (instancia) return instancia;

  fs.mkdirSync(path.dirname(config.caminhoBanco), { recursive: true });
  instancia = new Database(config.caminhoBanco);

  instancia.pragma('journal_mode = WAL');
  instancia.pragma('foreign_keys = ON');
  instancia.pragma('busy_timeout = 5000');

  return instancia;
}

export function aplicarSchema(db = obterBanco()) {
  const migracoes = ['001-multiple-carts.sql', '002-checkout-attempts.sql'];
  // schema.sql e a base v0. So e executada antes da primeira migracao;
  // reaplica-la no banco novo tentaria criar indices de colunas ja removidas.
  db.transaction(() => {
    const versao = db.pragma('user_version', { simple: true });
    if (versao > migracoes.length) throw new Error('Banco mais novo que esta versao da aplicacao.');
    if (versao === 0) db.exec(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
    for (let i = versao; i < migracoes.length; i++) {
      db.exec(fs.readFileSync(new URL(`./migrations/${migracoes[i]}`, import.meta.url), 'utf8'));
      db.pragma(`user_version = ${i + 1}`);
    }
    if (db.pragma('foreign_key_check').length) throw new Error('Migracao violou integridade referencial.');
  }).immediate();
}

export function fecharBanco() {
  if (instancia) {
    instancia.close();
    instancia = null;
  }
}

export function agoraISO() {
  return new Date().toISOString();
}
