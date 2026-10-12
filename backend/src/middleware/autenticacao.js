import jwt from 'jsonwebtoken';
import { config, emProducao } from '../config.js';
import { ApiError } from '../lib/ApiError.js';
import { buscarSessao, criarSessao } from '../services/sessaoService.js';

export function assinarToken(usuario) {
  return criarSessao(usuario);
}

/**
 * O token vai em cookie httpOnly, nao no corpo da resposta.
 *
 * Em localStorage qualquer script injetado na pagina le o token; httpOnly o
 * JavaScript nao enxerga. O preco e precisar de SameSite contra CSRF - "lax"
 * ja barra POST de outro site, e a loja nao faz acao sensivel por GET.
 */
export function definirCookieSessao(res, token) {
  res.cookie(config.jwt.nomeCookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: emProducao,
    maxAge: Math.max(0, jwt.decode(token).exp * 1000 - Date.now()),
    path: '/',
  });
}

export function limparCookieSessao(res) {
  res.clearCookie(config.jwt.nomeCookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: emProducao,
    path: '/',
  });
}

/** Exige sessao valida. Carrega o usuario em req.usuario. */
export function autenticar(req, res, next) {
  const token = req.cookies?.[config.jwt.nomeCookie];

  if (!token) {
    return next(ApiError.naoAutorizado('NAO_AUTENTICADO', 'Faca login para continuar.'));
  }

  const usuario = buscarSessao(token);
  if (!usuario) {
    // Uma resposta antiga de sessao revogada nao pode apagar o cookie emitido
    // por um login mais recente. Login/logout/troca de senha controlam o cookie.
    return next(ApiError.naoAutorizado('SESSAO_INVALIDA', 'Sua sessao expirou. Entre de novo.'));
  }

  req.usuario = usuario;
  next();
}
