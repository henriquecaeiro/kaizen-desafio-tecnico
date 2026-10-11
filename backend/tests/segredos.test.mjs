import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('scanner verifica arquivos e historico sem imprimir o valor identificado', () => {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'kaizen-segredos-'));
  const git = (...args) => execFileSync('git', args, { cwd: diretorio, stdio: 'pipe' });
  const verificar = () => spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/verificar-segredos.mjs', import.meta.url))], { cwd: diretorio, encoding: 'utf8' });
  try {
    fs.mkdirSync(path.join(diretorio, 'backend'));
    git('init', '-b', 'main');
    const commit = () => { git('add', '.'); git('-c', 'user.name=Teste', '-c', 'user.email=teste@example.test', 'commit', '-m', 'fixture'); };
    fs.writeFileSync(path.join(diretorio, 'README.md'), 'Fixture sem credenciais'); commit();
    assert.equal(verificar().status, 0);
    const valor = 'z'.repeat(48);
    fs.writeFileSync(path.join(diretorio, 'config.js'), `const SIAC_TOKEN='${valor}';`); commit();
    const comSegredo = verificar(); assert.equal(comSegredo.status, 1);
    assert.match(comSegredo.stderr, /config.js/); assert.ok(!comSegredo.stderr.includes(valor));
    fs.writeFileSync(path.join(diretorio, 'config.js'), 'const SIAC_TOKEN=process.env.SIAC_TOKEN;'); commit();
    const historico = verificar(); assert.equal(historico.status, 1); assert.match(historico.stderr, /historico/);
    assert.ok(!historico.stderr.includes(valor));
  } finally { fs.rmSync(diretorio, { recursive: true }); }
});
