import { Router } from 'express';
import { autenticar } from '../middleware/autenticacao.js';
import {
  buscarPedidoDoUsuario,
  finalizarPedido,
  listarPedidos,
} from '../services/pedidoService.js';
import {
  ColetorDeErros,
  exigirObjeto,
  inteiroPositivo,
  lerPaginacao,
  textoOpcional,
} from '../lib/validacao.js';

export const rotasPedidos = Router();

rotasPedidos.use(autenticar);

/**
 * POST /api/pedidos - checkout.
 * Pega o carrinho do usuario, manda para o ERP e limpa o carrinho.
 */
rotasPedidos.post('/', async (req, res) => {
  const corpo = exigirObjeto(req.body);
  const erros = new ColetorDeErros();

  const enderecoId = inteiroPositivo(corpo.endereco_id, 'endereco_id', erros, { max: 1e9 });
  const observacao = textoOpcional(corpo.observacao, 'observacao', erros, { max: 300 });
  const carrinhoId = corpo.carrinho_id === undefined ? undefined : inteiroPositivo(corpo.carrinho_id, 'carrinho_id', erros, { max: Number.MAX_SAFE_INTEGER });
  const tentativaId = corpo.tentativa_id === undefined ? undefined : textoOpcional(corpo.tentativa_id, 'tentativa_id', erros, { max: 36 });
  if (corpo.tentativa_id !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tentativaId ?? '')) {
    erros.adicionar('tentativa_id', 'Deve ser um UUID valido.');
  }

  erros.lancarSeInvalido('Nao foi possivel fechar o pedido.');

  const pedido = await finalizarPedido(req.usuario, enderecoId, observacao, undefined, { carrinhoId, tentativaId });

  res.status(201).location(`/api/pedidos/${pedido.numero}`).json({ dados: pedido });
});

/** GET /api/pedidos - so os pedidos de quem esta logado. */
rotasPedidos.get('/', async (req, res) => {
  const { pagina, tamanho } = lerPaginacao({ ...req.query, tamanho: req.query.tamanho ?? '10' });
  const { pedidos, paginacao } = await listarPedidos(req.usuario.id, { pagina, tamanho });

  res.json({ dados: pedidos, paginacao });
});

/** GET /api/pedidos/:numero */
rotasPedidos.get('/:numero', async (req, res) => {
  res.json({ dados: await buscarPedidoDoUsuario(req.usuario.id, req.params.numero) });
});
