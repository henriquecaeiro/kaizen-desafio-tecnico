import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

export async function criarBackup(origem, destino) {
  if (!origem || !destino) throw new Error('Informe banco de origem e arquivo de destino.');
  const caminhoOrigem = fs.realpathSync(origem);
  const caminhoDestino = path.resolve(destino);
  if (caminhoOrigem === caminhoDestino || fs.existsSync(caminhoDestino))
    throw new Error('O destino deve ser um arquivo novo, diferente da origem.');
  const parcial = `${caminhoDestino}.parcial`;
  const reserva = fs.openSync(parcial, 'wx', 0o600); fs.closeSync(reserva);
  let db;
  try {
    db = new Database(caminhoOrigem, { readonly: true, fileMustExist: true });
    // A API online do SQLite inclui o WAL de forma consistente. Copiar somente
    // ecommerce.db com o servidor ligado pode perder transacoes confirmadas.
    await db.backup(parcial);
    const copia = new Database(parcial, { readonly: true, fileMustExist: true });
    try {
      if (copia.pragma('integrity_check', { simple: true }) !== 'ok' || copia.pragma('foreign_key_check').length)
        throw new Error('Backup nao passou na verificacao de integridade.');
    } finally { copia.close(); }
    // link falha se outro processo tiver criado o destino: nunca sobrescrever.
    fs.linkSync(parcial, caminhoDestino);
    return caminhoDestino;
  } finally { db?.close(); fs.unlinkSync(parcial); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const destino = await criarBackup(process.argv[2], process.argv[3]);
    console.log(`Backup consistente criado: ${destino}`);
  } catch {
    console.error('Backup nao criado. Confira caminhos, permissao, integridade e se o destino e novo. Nenhum banco existente foi sobrescrito.');
    process.exitCode = 1;
  }
}
