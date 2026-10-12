import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digitos, formatarMascara, posicaoPorDigitos } from '../src/lib/mascaras.js';

for (const [tipo, entrada, esperado] of [
  ['documento', '12345678901', '123.456.789-01'],
  ['documento', '12345678000190', '12.345.678/0001-90'],
  ['telefone', '1133334444', '(11) 3333-4444'],
  ['telefone', '11987654321', '(11) 98765-4321'],
  ['cep', '01310100', '01310-100'],
]) test(`máscara ${tipo}: ${entrada}`, () => {
  assert.equal(formatarMascara(entrada, tipo), esperado);
  assert.equal(formatarMascara(esperado, tipo), esperado);
  assert.equal(formatarMascara('', tipo), '');
  assert.equal(digitos(esperado), entrada);
});
test('máscaras parciais, limites e posição por dígitos', () => {
  assert.equal(formatarMascara('1234', 'documento'), '123.4');
  assert.equal(formatarMascara('01310100123', 'cep'), '01310-100');
  assert.equal(posicaoPorDigitos('123.456.789-01', 4), 5);
  assert.equal(posicaoPorDigitos('(11) 98765-4321', 3), 6);
});
