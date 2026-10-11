import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { obterBanco, agoraISO } from '../db/index.js';
import { ApiError } from '../lib/ApiError.js';

export function criarSessao(usuario, db = obterBanco()) {
  return db.transaction(() => {
    // O scrypt e assincrono: uma troca de senha pode ter ocorrido durante o login.
    // Comparar o hash aqui impede abrir uma sessao com credenciais ja substituidas.
    const atual = db.prepare('SELECT senha_hash FROM usuarios WHERE id=?').get(usuario.id);
    if (!atual || atual.senha_hash !== usuario.senha_hash) {
      throw ApiError.naoAutorizado('CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');
    }
    db.prepare('DELETE FROM sessoes WHERE expira_em <= ?').run(Date.now());
    const id = randomUUID();
    const token = jwt.sign({ sub: String(usuario.id), jti: id }, config.jwt.segredo, {
      algorithm: 'HS256', expiresIn: config.jwt.expiracao,
    });
    db.prepare('INSERT INTO sessoes(id,usuario_id,expira_em,criado_em) VALUES(?,?,?,?)')
      .run(id, usuario.id, jwt.decode(token).exp * 1000, agoraISO());
    return token;
  }).immediate();
}

function verificarToken(token) {
  try {
    const conteudo = jwt.verify(token, config.jwt.segredo, { algorithms: ['HS256'] });
    if (typeof conteudo.jti !== 'string' || !Number.isSafeInteger(Number(conteudo.sub))) return null;
    return conteudo;
  } catch { return null; }
}

export function buscarSessao(token, db = obterBanco()) {
  const conteudo = verificarToken(token);
  if (!conteudo) return null;
  return db.prepare(`SELECT u.* FROM sessoes s JOIN usuarios u ON u.id=s.usuario_id
    WHERE s.id=? AND s.usuario_id=? AND s.expira_em > ?`)
    .get(conteudo.jti, Number(conteudo.sub), Date.now()) ?? null;
}

export function revogarSessao(token, db = obterBanco()) {
  const conteudo = verificarToken(token);
  if (conteudo) db.prepare('DELETE FROM sessoes WHERE id=? AND usuario_id=?')
    .run(conteudo.jti, Number(conteudo.sub));
}
