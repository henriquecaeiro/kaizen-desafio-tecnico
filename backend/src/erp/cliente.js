import { Readable } from 'node:stream';
import { config } from '../config.js';
import { ApiError } from '../lib/ApiError.js';
import { exigirResposta, objeto, produtoValido, paginacaoValida, pedidoCriadoValido, pedidoValido } from './contratos.js';

/**
 * Cliente HTTP do Kaizen ERP.
 *
 * Todo acesso ao catalogo e aos pedidos passa por aqui. O token do ERP vive
 * SO neste processo - o navegador nunca o ve.
 *
 * Tradução de falhas:
 *   - rede/timeout/5xx do ERP  -> 502 ERP_INDISPONIVEL (problema nosso)
 *   - 401 do ERP               -> 502 ERP_NAO_AUTORIZADO (token mal configurado,
 *                                 nao e culpa de quem esta comprando)
 *   - 404/409/422 do ERP       -> repassado como veio, porque e informacao util
 *                                 para quem esta na loja (produto sumiu, faltou
 *                                 estoque, codigo invalido)
 */

function montarUrl(caminho, parametros) {
  const url = new URL(`${config.erp.url}${caminho}`);

  for (const [chave, valor] of Object.entries(parametros ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') {
      url.searchParams.set(chave, String(valor));
    }
  }

  return url;
}

async function requisitar(caminho, { parametros, metodo = 'GET', corpo } = {}) {
  const url = montarUrl(caminho, parametros);
  let resposta;

  try {
    resposta = await fetch(url, {
      method: metodo,
      headers: {
        'X-API-Token': config.erp.token,
        Accept: 'application/json',
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(config.erp.timeoutMs),
    });
  } catch (erro) {
    console.error(`[erp] falha de rede em ${metodo}; tipo=${erro?.name === 'TimeoutError' ? 'timeout' : 'rede'}`);

    throw new ApiError(
      502,
      'ERP_INDISPONIVEL',
      'Nao foi possivel falar com o sistema de estoque. Tente novamente em instantes.',
    );
  }

  let json = null;
  try {
    json = await resposta.json();
  } catch (erro) {
    if (resposta.ok) {
      if (erro?.name !== 'SyntaxError') throw new ApiError(502, 'ERP_INDISPONIVEL', 'Nao foi possivel ler a resposta do sistema de estoque.');
      exigirResposta(false);
    }
  }

  if (resposta.ok) {
    exigirResposta(objeto(json));
    return json;
  }

  const erroErp = json?.erro ?? {};

  if (resposta.status === 401) {
    console.error('[erp] token recusado pelo ERP - confira ERP_TOKEN no .env');
    throw new ApiError(
      502,
      'ERP_NAO_AUTORIZADO',
      'A loja nao conseguiu se autenticar no sistema de estoque.',
    );
  }

  // 404, 409 e 422 carregam informacao que o cliente precisa ver.
  if ([404, 409, 422].includes(resposta.status)) {
    throw new ApiError(
      resposta.status,
      erroErp.codigo ?? 'ERP_RECUSOU',
      erroErp.mensagem ?? 'O sistema de estoque recusou a operacao.',
      erroErp.detalhes,
    );
  }

  console.error(`[erp] status ${resposta.status} em ${metodo}`);

  throw new ApiError(
    502,
    'ERP_INDISPONIVEL',
    'O sistema de estoque respondeu de forma inesperada.',
  );
}

// ------------------------------------------------------------------ leitura --

export async function listarProdutos(filtros) {
  const json = await requisitar('/produtos', { parametros: filtros });
  exigirResposta(Array.isArray(json.dados) && json.dados.every(produtoValido) && paginacaoValida(json.paginacao));
  return json;
}

export async function buscarProduto(codigo) {
  const json = await requisitar(`/produtos/${encodeURIComponent(codigo)}`);
  exigirResposta(produtoValido(json.dados) && json.dados.codigo.toUpperCase() === String(codigo).toUpperCase());
  return json.dados;
}

export async function listarCategorias() {
  const json = await requisitar('/produtos/categorias');
  exigirResposta(Array.isArray(json.dados) && json.dados.every(categoria => typeof categoria === 'string' && categoria.trim()));
  return json.dados;
}

export async function buscarPedido(numero) {
  const json = await requisitar(`/pedidos/${encodeURIComponent(numero)}`);
  exigirResposta(pedidoValido(json.dados) && json.dados.numero.toUpperCase() === String(numero).toUpperCase());
  return json.dados;
}

// ------------------------------------------------------------------ escrita --

export async function criarPedido(payload) {
  const json = await requisitar('/pedidos', { metodo: 'POST', corpo: payload });
  const pedido = json?.dados;
  exigirResposta(pedidoCriadoValido(pedido));
  return pedido;
}

// ------------------------------------------------------------------ imagens --

/**
 * Repassa a imagem do ERP. O front so conhece a URL da loja, entao o ERP pode
 * ficar numa rede privada sem ser exposto ao navegador.
 */
export async function obterImagem(arquivo) {
  const url = montarUrl(`/imagens/${encodeURIComponent(arquivo)}`);
  let resposta;

  try {
    resposta = await fetch(url, { signal: AbortSignal.timeout(config.erp.timeoutMs) });
  } catch {
    throw new ApiError(502, 'ERP_INDISPONIVEL', 'Nao foi possivel carregar a imagem.');
  }

  if (resposta.status === 404) throw ApiError.naoEncontrado('Imagem nao encontrada.');
  if (resposta.status === 401) throw new ApiError(502, 'ERP_NAO_AUTORIZADO', 'Nao foi possivel carregar a imagem.');
  if (!resposta.ok) throw new ApiError(502, 'ERP_INDISPONIVEL', 'Nao foi possivel carregar a imagem.');
  const tipo = resposta.headers.get('content-type');
  exigirResposta(tipo?.split(';')[0].trim().toLowerCase() === 'image/svg+xml' && resposta.body);
  const origem = Readable.fromWeb(resposta.body);
  const leitor = origem[Symbol.asyncIterator]();
  let primeiro;
  try { primeiro = await leitor.next(); }
  catch { throw new ApiError(502, 'ERP_INDISPONIVEL', 'Nao foi possivel ler a imagem.'); }
  exigirResposta(!primeiro.done);

  return {
    tipo,
    // Verifica corpo vazio antes de enviar headers, sem carregar toda a imagem.
    fluxo: Readable.from((async function* () {
      yield primeiro.value;
      yield* leitor;
    })()),
  };
}

// ------------------------------------------------------------------- health --

export async function verificarErp() {
  try {
    const resposta = await fetch(`${config.erp.url}/health`, {
      signal: AbortSignal.timeout(Math.min(config.erp.timeoutMs, 3000)),
    });
    if (!resposta.ok) return `http ${resposta.status}`;
    const json = await resposta.json();
    if (!objeto(json) || typeof json.status !== 'string') return 'resposta invalida';
    return json.status === 'ok' ? 'ok' : 'indisponivel';
  } catch (erro) {
    return erro?.name === 'SyntaxError' ? 'resposta invalida' : erro?.name === 'TimeoutError' ? 'timeout' : 'inacessivel';
  }
}
