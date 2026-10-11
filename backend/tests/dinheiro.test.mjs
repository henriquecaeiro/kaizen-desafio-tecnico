import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paraCentavos, paraReais } from '../src/lib/dinheiro.js';

for (const [valor, esperado] of [[0, 0], [1.15, 115], [1.005, 101], [10.075, 1008], ['19.99', 1999], [684, 68400]]) {
  test(`conversao monetaria ${valor} → ${esperado}`, () => assert.equal(paraCentavos(valor), esperado));
}
test('soma e multiplicacao usam centavos inteiros', () => {
  assert.equal(paraReais(paraCentavos(1.15) * 3 + paraCentavos(19.99) * 4), 83.41);
});
test('valores invalidos sao rejeitados', () => {
  for (const valor of [NaN, Infinity, -1, 'invalido', 1e20]) assert.throws(() => paraCentavos(valor), RangeError);
});
