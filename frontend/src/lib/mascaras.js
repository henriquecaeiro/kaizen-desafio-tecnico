export const digitos = valor => String(valor ?? '').replace(/\D/g, '');

export function formatarMascara(valor, tipo) {
  const numero = digitos(valor);
  const modelo = tipo === 'documento'
    ? numero.length > 11 ? '00.000.000/0000-00' : '000.000.000-00'
    : tipo === 'telefone'
      ? numero.length > 10 ? '(00) 00000-0000' : '(00) 0000-0000'
      : '00000-000';
  let indice = 0;
  let texto = '';
  for (const caractere of modelo) {
    if (indice >= numero.length) break;
    texto += caractere === '0' ? numero[indice++] : caractere;
  }
  return texto;
}

export function posicaoPorDigitos(texto, quantidade) {
  if (quantidade === 0) return texto.startsWith('(') ? 1 : 0;
  let contagem = 0;
  for (let i = 0; i < texto.length; i++) {
    if (/\d/.test(texto[i]) && ++contagem === quantidade) return i + 1;
  }
  return texto.length;
}
