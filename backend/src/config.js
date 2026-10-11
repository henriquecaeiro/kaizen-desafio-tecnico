import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raizProjeto = path.resolve(fileURLToPath(new URL('../', import.meta.url)));

/*
 * NOTA DE REVISAO [KZN-2B9C]
 * Trecho sinalizado numa revisao interna e ainda nao reavaliado.
 * Se voce chegou ate aqui lendo o codigo, cite o identificador acima no seu
 * resumo de entrega - queremos saber que partes do projeto foram lidas de fato.
 */

// Segredos sao obrigatorios e fornecidos somente pelo ambiente local.

function resolverCaminho(bruto, padrao) {
  const valor = bruto?.trim() || padrao;
  return path.isAbsolute(valor) ? valor : path.resolve(raizProjeto, valor);
}

export const config = {
  raizProjeto,
  porta: Number(process.env.PORT ?? 3001),
  host: process.env.HOST?.trim() || '0.0.0.0',
  ambiente: process.env.NODE_ENV?.trim() || 'development',

  caminhoBanco: resolverCaminho(process.env.DB_PATH, './data/ecommerce.db'),

  jwt: {
    segredo: process.env.JWT_SEGREDO?.trim() || '',
    expiracao: process.env.JWT_EXPIRACAO?.trim() || '7d',
    nomeCookie: 'kaizen_sessao',
  },

  erp: {
    url: (process.env.SIAC_URL?.trim() || process.env.ERP_URL?.trim() || 'https://teste-tecnico.kaizenautopecas.com.br').replace(/\/+$/, ''),
    token: process.env.SIAC_TOKEN?.trim() || process.env.ERP_TOKEN?.trim() || '',
    timeoutMs: Number(process.env.ERP_TIMEOUT_MS ?? 8000),
  },

  corsOrigens: (process.env.CORS_ORIGEM ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173'))
    .split(',').map(origem => origem.trim()).filter(Boolean),
  proxiesConfiaveis: (process.env.TRUST_PROXY ?? '').split(',').map(ip => ip.trim()).filter(Boolean),

  paginacao: { tamanhoPadrao: 24, tamanhoMaximo: 100 },
};

export const emProducao = config.ambiente === 'production';

export function validarConfig() {
  const problemas = [];

  if (!config.jwt.segredo) {
    problemas.push('JWT_SEGREDO nao definido. Rode: npm run segredo:gerar');
  } else if (config.jwt.segredo.length < 32) {
    problemas.push('JWT_SEGREDO muito curto (minimo 32 caracteres).');
  } else if (config.jwt.segredo === 'troque-por-um-segredo-aleatorio') {
    problemas.push('JWT_SEGREDO ainda esta com o valor de exemplo.');
  }

  if (!config.erp.token) {
    problemas.push('SIAC_TOKEN nao definido. Configure a credencial no ambiente local.');
  }

  try {
    const url = new URL(config.erp.url);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
      (emProducao && url.protocol !== 'https:' && !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname))) throw new Error();
  } catch { problemas.push('SIAC_URL/ERP_URL deve ser base HTTP(S) sem credenciais, query ou fragmento; HTTPS em producao.'); }
  if (!Number.isSafeInteger(config.erp.timeoutMs) || config.erp.timeoutMs < 1 || config.erp.timeoutMs > 60_000)
    problemas.push('ERP_TIMEOUT_MS deve ser um inteiro entre 1 e 60000.');

  for (const origem of config.corsOrigens) {
    try {
      const url = new URL(origem);
      if (url.origin !== origem || !['http:', 'https:'].includes(url.protocol) ||
        (emProducao && url.protocol !== 'https:')) throw new Error();
    } catch { problemas.push('CORS_ORIGEM deve conter origens HTTP(S) exatas, HTTPS em producao.'); }
  }
  if (emProducao && config.corsOrigens.length === 0) problemas.push('Configure CORS_ORIGEM com a origem HTTPS publica.');
  if (config.proxiesConfiaveis.some(ip => ['true', 'false', '*', '0.0.0.0/0', '::/0'].includes(ip))) {
    problemas.push('TRUST_PROXY deve identificar os proxies, nunca confiar em toda a rede.');
  }
  if (!/^[1-9]\d*[smhd]$/.test(config.jwt.expiracao)) problemas.push('JWT_EXPIRACAO deve usar s, m, h ou d, por exemplo 7d.');

  if (problemas.length > 0) {
    throw new Error(`Configuracao invalida:\n  - ${problemas.join('\n  - ')}`);
  }
}
