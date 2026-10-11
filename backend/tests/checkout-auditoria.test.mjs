import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { prepararAmbiente } from '../test-support/ambiente.mjs';
const e = await prepararAmbiente();
const carrinhos = await import('../src/services/carrinhosService.js');
after(e.fechar);
async function esperar(condicao) {
  for (let i = 0; i < 200; i++) {
    if (condicao()) return;
    await new Promise(r => setTimeout(r, 5));
  }
  throw new Error('Processo nao atingiu a barreira');
}

test('dois usuarios podem fechar carrinhos simultaneamente sem compartilhar dados', async () => {
  e.semear([['FIL', 2]], e.a.id); e.semear([['SUS', 3]], e.b.id);
  let liberar; e.controle.barreira = new Promise(r => { liberar = r; });
  const total = e.pedidos.length;
  const pedidos = [e.pedido.finalizarPedido(e.a, e.casa.id, ''), e.pedido.finalizarPedido(e.b, e.enderecoB.id, '')];
  try { await esperar(() => e.pedidos.length === total + 2); }
  finally { liberar(); e.controle.barreira = null; }
  const [a, b] = await Promise.all(pedidos);
  assert.notEqual(a.numero, b.numero);
  assert.equal(a.endereco_entrega.id, e.casa.id); assert.equal(b.endereco_entrega.id, e.enderecoB.id);
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).itens.length, 0);
  assert.equal((await e.carrinho.lerCarrinho(e.b.id)).itens.length, 0);
  await assert.rejects(e.pedido.buscarPedidoDoUsuario(e.b.id, a.numero), { status: 404 });
});

for (const estado of ['VALIDANDO', 'ENVIANDO']) test(`queda real do processo em ${estado} conserva reserva apos reinicio`, async () => {
  const cart = carrinhos.criarCarrinho(e.a.id, `Interrupcao ${estado}`); carrinhos.ativarCarrinho(e.a.id, cart.id);
  e.semear([['FIL', 1]]);
  let liberar;
  const barreira = new Promise(r => { liberar = r; });
  if (estado === 'VALIDANDO') e.controle.produtoBarreira = barreira;
  else e.controle.barreira = barreira;
  const programa = `
    import { aplicarSchema, obterBanco } from './src/db/index.js';
    import { finalizarPedido } from './src/services/pedidoService.js';
    import { buscarUsuarioPorId } from './src/services/usuarioService.js';
    aplicarSchema();
    try { await finalizarPedido(buscarUsuarioPorId(${e.a.id}), ${e.casa.id}, ''); }
    catch (erro) { console.log(erro.codigo); }
    obterBanco().close();
  `;
  const processo = spawn(process.execPath, ['--input-type=module', '-e', programa], { cwd: e.config.raizProjeto,
    env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let saida = ''; processo.stdout.on('data', dado => { saida += dado; });
  const total = e.pedidos.length;
  try {
    await esperar(() => e.db.prepare('SELECT estado FROM checkout_tentativas WHERE carrinho_id=?').get(cart.id)?.estado === estado);
    if (estado === 'ENVIANDO') await esperar(() => e.pedidos.length === total + 1);
    processo.kill('SIGKILL'); await once(processo, 'exit');
  } finally {
    if (processo.exitCode === null && processo.signalCode === null) { processo.kill('SIGKILL'); await once(processo, 'exit'); }
    liberar(); e.controle.produtoBarreira = null; e.controle.barreira = null;
  }
  const reiniciado = spawn(process.execPath, ['--input-type=module', '-e', programa], { cwd: e.config.raizProjeto,
    env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let retorno = ''; reiniciado.stdout.on('data', dado => { retorno += dado; });
  const [codigo] = await once(reiniciado, 'exit');
  assert.equal(codigo, 0); assert.match(retorno, /CHECKOUT_EM_ANDAMENTO/);
  assert.equal(e.pedidos.length, total + (estado === 'ENVIANDO' ? 1 : 0));
  assert.equal((await e.carrinho.lerCarrinho(e.a.id)).quantidade_pecas, 1);
  assert.throws(() => e.carrinho.limparCarrinho(e.a.id), { codigo: 'CHECKOUT_EM_ANDAMENTO' });
});
