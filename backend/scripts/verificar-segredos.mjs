import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const raiz = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const arquivos = execFileSync('git', ['ls-files', '-z'], { cwd: raiz, encoding: 'utf8' }).split('\0').filter(Boolean);
const ambiente = path.join(raiz, 'backend/.env');
const segredos = fs.existsSync(ambiente) ? fs.readFileSync(ambiente, 'utf8').split('\n')
  .filter(l => /^(SIAC_TOKEN|ERP_TOKEN|JWT_SEGREDO)=/.test(l))
  .map(l => l.slice(l.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, ''))
  .filter(v => v.length >= 16 && !v.includes('troque-')) : [];
const suspeitos = arquivos.filter(arquivo => {
  const conteudo = fs.readFileSync(path.join(raiz, arquivo)).toString();
  return /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/.test(conteudo) ||
    segredos.some(segredo => conteudo.includes(segredo)) ||
    /(^|\/)\.env$|\.db(-wal|-shm)?$/.test(arquivo);
});
if (suspeitos.length) {
  console.error('Arquivos com possivel segredo:', suspeitos.join(', '));
  process.exitCode = 1;
} else console.log(`Verificacao de ${arquivos.length} arquivos: nenhum segredo local ou banco encontrado.`);
