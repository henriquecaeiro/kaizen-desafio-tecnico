const BASE = '/api';
// O proxy estatico repassa este header nao sensivel ao ngrok gratuito.
export const CABECALHOS_API = { 'ngrok-skip-browser-warning': '1' };

/**
 * Erro vindo da API, com o formato que o backend sempre devolve:
 *   { erro: { codigo, mensagem, detalhes? }, request_id }
 */
export class ErroApi extends Error {
  constructor(status, codigo, mensagem, detalhes) {
    super(mensagem);
    this.name = 'ErroApi';
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }

  /**
   * Transforma os detalhes de validacao em { campo: mensagem }, que e como os
   * formularios consomem para marcar cada input.
   */
  get porCampo() {
    if (!Array.isArray(this.detalhes)) return {};

    return this.detalhes.reduce((acumulado, item) => {
      if (item?.campo) acumulado[item.campo] = item.mensagem;
      return acumulado;
    }, {});
  }
}

function montarQuery(parametros) {
  const busca = new URLSearchParams();

  for (const [chave, valor] of Object.entries(parametros ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') {
      busca.set(chave, String(valor));
    }
  }

  const texto = busca.toString();
  return texto ? `?${texto}` : '';
}

async function requisitar(caminho, { metodo = 'GET', corpo, parametros, carrinhoId } = {}) {
  let resposta;

  try {
    resposta = await fetch(`${BASE}${caminho}${montarQuery(parametros)}`, {
      method: metodo,
      credentials: 'include',
      headers: {
        ...CABECALHOS_API,
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
        ...(carrinhoId ? { 'X-Carrinho-Id': String(carrinhoId) } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ErroApi(0, 'SEM_CONEXAO', 'Nao foi possivel falar com o servidor.');
  }

  if (resposta.status === 204) return null;

  const json = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const erro = json?.erro ?? {};
    throw new ErroApi(
      resposta.status,
      erro.codigo ?? 'ERRO_DESCONHECIDO',
      erro.mensagem ?? 'Algo deu errado. Tente novamente.',
      erro.detalhes,
    );
  }

  if (json === null || typeof json !== 'object') {
    throw new ErroApi(502, 'RESPOSTA_INVALIDA', 'O servidor retornou uma resposta inválida. Tente novamente.');
  }

  return json;
}

export const api = {
  auth: {
    cadastrar: (dados) => requisitar('/auth/cadastro', { metodo: 'POST', corpo: dados }),
    entrar: (dados) => requisitar('/auth/login', { metodo: 'POST', corpo: dados }),
    sair: () => requisitar('/auth/logout', { metodo: 'POST' }),
    eu: () => requisitar('/auth/eu'),
  },

  perfil: {
    ler: () => requisitar('/perfil'),
    salvar: (dados) => requisitar('/perfil', { metodo: 'PATCH', corpo: dados }),
    trocarSenha: (dados) => requisitar('/perfil/senha', { metodo: 'PATCH', corpo: dados }),
  },

  enderecos: {
    listar: () => requisitar('/enderecos'),
    criar: (dados) => requisitar('/enderecos', { metodo: 'POST', corpo: dados }),
    salvar: (id, dados) => requisitar(`/enderecos/${id}`, { metodo: 'PUT', corpo: dados }),
    remover: (id) => requisitar(`/enderecos/${id}`, { metodo: 'DELETE' }),
  },

  catalogo: {
    listar: (filtros) => requisitar('/catalogo', { parametros: filtros }),
    categorias: () => requisitar('/catalogo/categorias'),
    produto: (codigo) => requisitar(`/catalogo/${encodeURIComponent(codigo)}`),
  },

  carrinho: {
    ler: () => requisitar('/carrinho'),
    adicionar: (codigo_produto, quantidade = 1, carrinhoId) =>
      requisitar('/carrinho/itens', {
        metodo: 'POST',
        corpo: { codigo_produto, quantidade },
        carrinhoId,
      }),
    alterar: (codigo, quantidade, carrinhoId) =>
      requisitar(`/carrinho/itens/${encodeURIComponent(codigo)}`, {
        metodo: 'PATCH',
        corpo: { quantidade },
        carrinhoId,
      }),
    remover: (codigo, carrinhoId) =>
      requisitar(`/carrinho/itens/${encodeURIComponent(codigo)}`, { metodo: 'DELETE', carrinhoId }),
    limpar: (carrinhoId) => requisitar('/carrinho', { metodo: 'DELETE', carrinhoId }),
  },

  carrinhos: {
    listar: () => requisitar('/carrinhos'),
    criar: (nome) => requisitar('/carrinhos', { metodo: 'POST', corpo: { nome } }),
    renomear: (id, nome) => requisitar(`/carrinhos/${id}`, { metodo: 'PATCH', corpo: { nome } }),
    ativar: (id) => requisitar(`/carrinhos/${id}/ativar`, { metodo: 'PUT' }),
    excluir: (id) => requisitar(`/carrinhos/${id}`, { metodo: 'DELETE' }),
  },

  pedidos: {
    criar: (dados) => requisitar('/pedidos', { metodo: 'POST', corpo: dados }),
    listar: (parametros) => requisitar('/pedidos', { parametros }),
    detalhe: (numero) => requisitar(`/pedidos/${encodeURIComponent(numero)}`),
  },
};

export const dinheiro = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatarData(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
