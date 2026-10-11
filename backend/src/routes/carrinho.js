import { Router } from 'express';
import { autenticar } from '../middleware/autenticacao.js';
import {
  adicionarItem,
  alterarQuantidade,
  lerCarrinho,
  limparCarrinho,
  removerItem,
  MAXIMO_POR_ITEM,
} from '../services/carrinhoService.js';
import { ColetorDeErros, exigirObjeto, inteiroPositivo, textoObrigatorio } from '../lib/validacao.js';
import { obterBanco } from '../db/index.js';

export const rotasCarrinho = Router();

rotasCarrinho.use(autenticar);
// Clientes antigos podem omitir o header. O frontend novo envia o id que esta
// exibindo para evitar aplicar uma acao a outro carrinho ativado em outra aba.
rotasCarrinho.use((req, _res, next) => {
  const valor = req.get('X-Carrinho-Id');
  if (valor !== undefined) {
    const erros = new ColetorDeErros();
    req.carrinhoEsperado = inteiroPositivo(valor, 'carrinho_id', erros, { max: Number.MAX_SAFE_INTEGER });
    erros.lancarSeInvalido('Identificador do carrinho invalido.');
  }
  next();
});

/** Carrinho e por usuario e fica no banco: fechar o navegador nao perde nada. */
rotasCarrinho.get('/', async (req, res) => {
  res.json({ dados: await lerCarrinho(req.usuario.id) });
});

rotasCarrinho.post('/itens', async (req, res) => {
  const corpo = exigirObjeto(req.body);
  const erros = new ColetorDeErros();

  const codigo = textoObrigatorio(corpo.codigo_produto, 'codigo_produto', erros, { min: 1, max: 40 });
  const quantidade = inteiroPositivo(corpo.quantidade ?? 1, 'quantidade', erros, { max: MAXIMO_POR_ITEM });

  erros.lancarSeInvalido('Nao foi possivel adicionar ao carrinho.');

  res.status(201).json({ dados: await adicionarItem(req.usuario.id, codigo, quantidade, obterBanco(), req.carrinhoEsperado) });
});

rotasCarrinho.patch('/itens/:codigo', async (req, res) => {
  const corpo = exigirObjeto(req.body);
  const erros = new ColetorDeErros();

  const quantidade = inteiroPositivo(corpo.quantidade, 'quantidade', erros, { max: MAXIMO_POR_ITEM });

  erros.lancarSeInvalido('Quantidade invalida.');

  res.json({ dados: await alterarQuantidade(req.usuario.id, req.params.codigo, quantidade, obterBanco(), req.carrinhoEsperado) });
});

rotasCarrinho.delete('/itens/:codigo', async (req, res) => {
  res.json({ dados: await removerItem(req.usuario.id, req.params.codigo, obterBanco(), req.carrinhoEsperado) });
});

rotasCarrinho.delete('/', async (req, res) => {
  limparCarrinho(req.usuario.id, obterBanco(), req.carrinhoEsperado);
  res.json({ dados: await lerCarrinho(req.usuario.id) });
});
