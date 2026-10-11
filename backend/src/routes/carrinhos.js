import { Router } from 'express';
import { autenticar } from '../middleware/autenticacao.js';
import { ColetorDeErros, exigirObjeto, inteiroPositivo, textoObrigatorio } from '../lib/validacao.js';
import { listarCarrinhos, criarCarrinho, renomearCarrinho, ativarCarrinho, excluirCarrinho } from '../services/carrinhosService.js';

export const rotasCarrinhos = Router();
rotasCarrinhos.use(autenticar);

function lerNome(corpo) {
  const erros = new ColetorDeErros();
  const nome = textoObrigatorio(exigirObjeto(corpo).nome, 'nome', erros, { max: 80 });
  erros.lancarSeInvalido('Nome do carrinho invalido.');
  return nome;
}
function lerId(id) {
  const erros = new ColetorDeErros();
  const valor = inteiroPositivo(id, 'id', erros, { max: Number.MAX_SAFE_INTEGER });
  erros.lancarSeInvalido('Identificador do carrinho invalido.');
  return valor;
}

rotasCarrinhos.get('/', (req, res) => res.json({ dados: listarCarrinhos(req.usuario.id) }));
rotasCarrinhos.post('/', (req, res) => res.status(201).json({ dados: criarCarrinho(req.usuario.id, lerNome(req.body)) }));
rotasCarrinhos.patch('/:id', (req, res) => res.json({ dados: renomearCarrinho(req.usuario.id, lerId(req.params.id), lerNome(req.body)) }));
rotasCarrinhos.put('/:id/ativar', (req, res) => res.json({ dados: ativarCarrinho(req.usuario.id, lerId(req.params.id)) }));
rotasCarrinhos.delete('/:id', (req, res) => {
  excluirCarrinho(req.usuario.id, lerId(req.params.id));
  res.json({ dados: listarCarrinhos(req.usuario.id) });
});
