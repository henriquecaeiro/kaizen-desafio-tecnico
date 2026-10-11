import { createHash } from 'node:crypto';
import { obterBanco } from '../db/index.js';
import { ApiError } from '../lib/ApiError.js';

const POLITICAS = {
  login: { janela: 15 * 60_000, ip: 30, conta: 10 },
  cadastro: { janela: 60 * 60_000, ip: 5 },
  senha: { janela: 15 * 60_000, ip: 10, conta: 5 },
};

export function limitarAutenticacao(tipo) {
  const politica = POLITICAS[tipo];
  return (req, res, next) => {
    const db = obterBanco();
    const agora = Date.now();
    const conta = tipo === 'senha' ? String(req.usuario.id) :
      (typeof req.body?.email === 'string' && req.body.email.length <= 160 ? req.body.email.trim().toLowerCase() : null);
    const chaves = [[`ip:${req.ip}`, politica.ip]];
    if (politica.conta && conta) chaves.push([`conta:${conta}`, politica.conta]);

    // SQLite compartilha contadores entre processos que usam o mesmo banco.
    // Nao guardamos e-mail/IP em claro, e reiniciar nao remove o limite.
    const espera = db.transaction(() => {
      db.prepare('DELETE FROM autenticacao_limites WHERE expira_em <= ?').run(agora);
      const limites = chaves.map(([valor, maximo]) => ({
        chave: createHash('sha256').update(`${tipo}:${valor}`).digest('hex'), maximo,
      }));
      for (const { chave, maximo } of limites) {
        const linha = db.prepare('SELECT * FROM autenticacao_limites WHERE chave=?').get(chave);
        if (linha && linha.tentativas >= maximo) return Math.max(1, Math.ceil((linha.expira_em - agora) / 1000));
      }
      for (const { chave } of limites) {
        db.prepare(`INSERT INTO autenticacao_limites(chave,tentativas,expira_em) VALUES(?,1,?)
          ON CONFLICT(chave) DO UPDATE SET tentativas=tentativas+1`).run(chave, agora + politica.janela);
      }
      return 0;
    }).immediate();
    if (espera) {
      res.setHeader('Retry-After', espera);
      return next(new ApiError(429, 'MUITAS_TENTATIVAS', 'Muitas tentativas. Aguarde antes de tentar novamente.'));
    }
    next();
  };
}
