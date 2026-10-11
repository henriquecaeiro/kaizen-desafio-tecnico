import { test } from 'node:test';
import assert from 'node:assert/strict';
import { config, validarConfig } from '../src/config.js';

function conferir(alteracoes, esperado) {
  const original = { ...config, erp: { ...config.erp }, jwt: { ...config.jwt } };
  Object.assign(config, { ...alteracoes, jwt: { ...config.jwt, segredo: 'a'.repeat(48), ...alteracoes.jwt },
    erp: { ...config.erp, token: 'somente-mock', ...alteracoes.erp } });
  try { esperado ? assert.throws(validarConfig, esperado) : assert.doesNotThrow(validarConfig); }
  finally { Object.assign(config, original); }
}
test('configuracao de desenvolvimento permite origem exata e proxy desabilitado', () => {
  conferir({ corsOrigens: ['http://localhost:5173'], proxiesConfiaveis: [] }, null);
});
test('CORS rejeita wildcard, null, caminho e credenciais na origem', () => {
  for (const origem of ['*', 'null', 'https://loja.test/path', 'https://usuario:senha@loja.test'])
    conferir({ corsOrigens: [origem] }, /CORS_ORIGEM/);
});
test('trust proxy nao aceita configuracao que confia em qualquer remetente', () => {
  for (const proxy of ['true', '*', '0.0.0.0/0', '::/0']) conferir({ proxiesConfiaveis: [proxy] }, /TRUST_PROXY/);
});
test('base ERP nao permite credenciais ou parametros e erro nao exibe valores', () => {
  for (const url of ['https://usuario:marcador-sensivel@erp.test', 'https://erp.test?token=marcador-sensivel', 'ftp://erp.test']) {
    const original = config.erp; config.erp = { ...original, token: 'somente-mock', url };
    try {
      assert.throws(validarConfig, erro => erro.message.includes('SIAC_URL') && !erro.message.includes('marcador-sensivel'));
    } finally { config.erp = original; }
  }
});
test('timeout e expiracao invalida falham antes de iniciar servidor', () => {
  for (const timeoutMs of [NaN, 0, -1, 100_000]) conferir({ erp: { timeoutMs } }, /ERP_TIMEOUT_MS/);
  for (const expiracao of ['0d', '7', 'indefinida']) conferir({ jwt: { expiracao } }, /JWT_EXPIRACAO/);
});
