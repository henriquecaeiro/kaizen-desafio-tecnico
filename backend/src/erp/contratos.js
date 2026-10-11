import { ApiError } from '../lib/ApiError.js';

export function exigirResposta(condicao) {
  if (!condicao) throw new ApiError(502, 'ERP_RESPOSTA_INVALIDA', 'O sistema de estoque retornou dados invalidos.');
}

export const objeto = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const texto = valor => typeof valor === 'string' && valor.trim().length > 0;
const inteiro = valor => Number.isSafeInteger(valor) && valor >= 0;
const dinheiro = valor => typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && Number.isSafeInteger(Math.round(valor * 100));

// Valida os campos consumidos pela loja, sem fechar enums ou rejeitar campos
// adicionais do SIAC. Preco e estoque invalidos nunca viram disponibilidade zero.
export function produtoValido(produto) {
  return objeto(produto) && texto(produto.codigo) && texto(produto.descricao) &&
    texto(produto.marca) && texto(produto.categoria) && dinheiro(produto.preco_unitario) &&
    inteiro(produto.estoque) && [true, false, 0, 1].includes(produto.ativo) &&
    (produto.imagem_url == null || typeof produto.imagem_url === 'string');
}

export function paginacaoValida(paginacao) {
  return objeto(paginacao) && inteiro(paginacao.pagina) && paginacao.pagina > 0 &&
    inteiro(paginacao.tamanho) && paginacao.tamanho > 0 && inteiro(paginacao.total) &&
    inteiro(paginacao.total_paginas);
}

export function pedidoCriadoValido(pedido) {
  return objeto(pedido) && texto(pedido.numero) && dinheiro(pedido.valor_total);
}

export function pedidoValido(pedido) {
  return pedidoCriadoValido(pedido) && texto(pedido.situacao) &&
    texto(pedido.criado_em) && Number.isFinite(Date.parse(pedido.criado_em)) &&
    objeto(pedido.cliente) && texto(pedido.cliente.nome) && texto(pedido.cliente.documento) &&
    inteiro(pedido.quantidade_itens) && Array.isArray(pedido.itens) && pedido.itens.every(item =>
      objeto(item) && texto(item.codigo_produto) && texto(item.descricao) &&
      inteiro(item.quantidade) && item.quantidade > 0 && dinheiro(item.preco_unitario) && dinheiro(item.valor_total));
}
