/**
 * Dinheiro trafega em reais no JSON mas e armazenado e somado em centavos
 * (inteiro), para nao acumular erro de ponto flutuante no total do pedido.
 */

export function paraCentavos(reais) {
  const valor = Number(reais);
  if (!Number.isFinite(valor) || valor < 0) throw new RangeError('Valor monetario invalido.');
  // Valores do SIAC sao positivos; meio centavo arredonda para cima. A pequena
  // compensacao evita que representacoes como 1.005 fiquem abaixo do meio.
  const centavos = Math.round((valor + Number.EPSILON * Math.max(1, valor)) * 100);
  if (!Number.isSafeInteger(centavos)) throw new RangeError('Valor monetario fora do limite.');
  return centavos;
}

export function paraReais(centavos) {
  return Number((Number(centavos) / 100).toFixed(2));
}
