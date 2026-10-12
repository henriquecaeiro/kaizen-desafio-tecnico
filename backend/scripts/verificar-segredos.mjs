import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';

const raiz = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const arquivos = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: raiz, encoding: 'utf8' }).split('\0').filter(Boolean);
const segredos = [process.env.SIAC_TOKEN, process.env.ERP_TOKEN, process.env.JWT_SEGREDO]
  .filter(v => v && v.length >= 16 && !v.includes('troque-'));
for (const diretorio of [raiz, path.join(raiz, 'backend')]) {
  for (const nome of fs.readdirSync(diretorio).filter(n => n.startsWith('.env') && n !== '.env.example')) {
    const linhas = fs.readFileSync(path.join(diretorio, nome), 'utf8').split('\n');
    segredos.push(...linhas.filter(l => /^\s*(SIAC_TOKEN|ERP_TOKEN|JWT_SEGREDO)=/.test(l))
      .map(l => l.slice(l.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, ''))
      .filter(v => v.length >= 16 && !v.includes('troque-')));
  }
}
const ficticias = new Set(['credencial-ficticia-somente-loopback']);
function suspeito(arquivo, conteudo) {
  const literais = [...conteudo.matchAll(/(?:SIAC_TOKEN|ERP_TOKEN|JWT_SEGREDO)\s*(?:=|:)\s*['"]?([a-zA-Z0-9_-]{32,})(?:['"]|\s|$)/gm)];
  return /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/.test(conteudo) ||
    segredos.some(segredo => conteudo.includes(segredo)) ||
    literais.some(m => !ficticias.has(m[1])) ||
    /(^|\/)\.env(?:\.[^/]+)?$/.test(arquivo) && !arquivo.endsWith('.env.example') ||
    /\.(?:db|sqlite|sqlite3)(?:-wal|-shm|\.bak|\.parcial)?$/.test(arquivo);
}
const suspeitos = new Set();
for (const arquivo of arquivos) {
  const local = path.join(raiz, arquivo);
  if (fs.existsSync(local) && suspeito(arquivo, fs.readFileSync(local).toString())) suspeitos.add(arquivo);
}
// Le blobs uma unica vez, incluindo branches e historico. So nomes/SHAs sao
// exibidos: nunca imprimir o trecho que pode conter uma credencial.
const objetos = new Map();
for (const linha of execFileSync('git', ['rev-list', '--objects', '--all'], { cwd: raiz, encoding: 'utf8' }).trim().split('\n')) {
  const espaco = linha.indexOf(' ');
  if (espaco > 0) objetos.set(linha.slice(0, espaco), linha.slice(espaco + 1));
}
const resultado = spawnSync('git', ['cat-file', '--batch'], { cwd: raiz,
  input: [...objetos.keys()].join('\n') + '\n', maxBuffer: 64 * 1024 * 1024 });
if (resultado.status !== 0) throw new Error('Nao foi possivel verificar todo o historico Git.');
let posicao = 0; let blobs = 0;
while (posicao < resultado.stdout.length) {
  const fim = resultado.stdout.indexOf(10, posicao);
  const [sha, tipo, tamanho] = resultado.stdout.subarray(posicao, fim).toString().split(' ');
  const inicio = fim + 1; const final = inicio + Number(tamanho);
  if (tipo === 'blob') {
    blobs++;
    const arquivo = objetos.get(sha);
    if (suspeito(arquivo, resultado.stdout.subarray(inicio, final).toString())) suspeitos.add(`${arquivo} (historico ${sha.slice(0, 8)})`);
  }
  posicao = final + 1;
}
if (suspeitos.size) {
  console.error('Possivel segredo/banco; confira sem expor valores:', [...suspeitos].join(', '));
  process.exitCode = 1;
} else console.log(`Verificacao de ${arquivos.length} arquivos e ${blobs} blobs historicos: nenhum segredo/banco identificado pelos criterios do scanner.`);
