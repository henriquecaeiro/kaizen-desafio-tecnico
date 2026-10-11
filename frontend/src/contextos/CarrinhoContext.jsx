import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api/cliente.js';
import { useAuth } from './AuthContext.jsx';

const CarrinhoContext = createContext(null);

const VAZIO = {
  itens: [],
  quantidade_itens: 0,
  quantidade_pecas: 0,
  valor_total: 0,
  pronto_para_checkout: false,
};

/**
 * O carrinho mora no servidor, nao no localStorage: trocar de navegador ou de
 * celular mantem o que a pessoa escolheu, e o estoque e sempre conferido
 * contra o ERP na hora de ler.
 */
export function ProvedorCarrinho({ children }) {
  const { usuario } = useAuth();
  const usuarioId = usuario?.id ?? null;
  const sessao = useRef({ usuarioId, requisicao: 0 });
  const [estado, setEstado] = useState({ usuarioId: null, carrinho: VAZIO, carregando: false, erro: null });
  // A identidade tambem protege o render anterior ao efeito de login/logout.
  if (sessao.current.usuarioId !== usuarioId) sessao.current = { usuarioId, requisicao: 0 };

  const executar = useCallback(async (acao, propagarErro = true) => {
    const atual = sessao.current;
    if (!atual.usuarioId) return;
    const requisicao = ++atual.requisicao;
    const vigente = () => sessao.current === atual && atual.requisicao === requisicao;
    setEstado(e => ({ ...e, usuarioId: atual.usuarioId, carregando: true, erro: null }));
    try {
      const resposta = await acao();
      if (vigente()) setEstado({ usuarioId: atual.usuarioId, carrinho: resposta.dados, carregando: false, erro: null });
      return resposta;
    } catch (erro) {
      if (vigente()) setEstado(e => ({ ...e, carrinho: erro.status === 401 ? VAZIO : e.carrinho, carregando: false, erro }));
      if (propagarErro) throw erro;
    }
  }, []);

  const recarregar = useCallback(() => executar(() => api.carrinho.ler(), false), [executar]);

  useEffect(() => {
    setEstado({ usuarioId, carrinho: VAZIO, carregando: Boolean(usuarioId), erro: null });
    if (usuarioId) recarregar();
    return () => { sessao.current.requisicao++; };
  }, [usuarioId, recarregar]);

  const adicionar = useCallback((codigo, quantidade = 1) => executar(() => api.carrinho.adicionar(codigo, quantidade)), [executar]);
  const alterar = useCallback((codigo, quantidade) => executar(() => api.carrinho.alterar(codigo, quantidade)), [executar]);
  const remover = useCallback(codigo => executar(() => api.carrinho.remover(codigo)), [executar]);
  const limpar = useCallback(() => executar(() => api.carrinho.limpar()), [executar]);
  const visivel = estado.usuarioId === usuarioId ? estado : { carrinho: VAZIO, carregando: Boolean(usuarioId), erro: null };
  const valor = { ...visivel, recarregar, adicionar, alterar, remover, limpar };

  return <CarrinhoContext.Provider value={valor}>{children}</CarrinhoContext.Provider>;
}

export function useCarrinho() {
  const contexto = useContext(CarrinhoContext);
  if (!contexto) throw new Error('useCarrinho precisa estar dentro de <ProvedorCarrinho>.');
  return contexto;
}
