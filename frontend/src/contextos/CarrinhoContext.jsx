import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, ErroApi } from '../api/cliente.js';
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
  const [estado, setEstado] = useState({
    usuarioId: null,
    carrinho: VAZIO,
    carrinhos: [],
    carregando: false,
    erro: null,
  });
  // A identidade tambem protege o render anterior ao efeito de login/logout.
  if (sessao.current.usuarioId !== usuarioId) sessao.current = { usuarioId, requisicao: 0 };

  const executar = useCallback(async (acao, propagarErro = true) => {
    const atual = sessao.current;
    if (!atual.usuarioId) return;
    const requisicao = ++atual.requisicao;
    const vigente = () => sessao.current === atual && atual.requisicao === requisicao;
    setEstado((e) => ({ ...e, usuarioId: atual.usuarioId, carregando: true, erro: null }));
    try {
      let resposta = await acao();
      let lista = await api.carrinhos.listar();
      function conferirIdentidade() {
        if ((resposta.dados.usuario_id !== undefined && resposta.dados.usuario_id !== atual.usuarioId) ||
            lista.dados.some(c => c.usuario_id !== atual.usuarioId))
          throw new ErroApi(401, 'SESSAO_ALTERADA', 'A sessão mudou em outra aba. Recarregue a página para continuar.');
      }
      conferirIdentidade();
      if (lista.dados.find(c => c.ativo)?.id !== resposta.dados.id) {
        // Outra aba pode ter trocado o ativo durante a consulta ao estoque.
        resposta = await api.carrinho.ler();
        lista = await api.carrinhos.listar();
        conferirIdentidade();
        if (lista.dados.find(c => c.ativo)?.id !== resposta.dados.id)
          throw new ErroApi(409, 'CARRINHO_ALTERADO', 'O carrinho ativo mudou. Tente atualizar novamente.');
      }
      if (vigente())
        setEstado({
          usuarioId: atual.usuarioId,
          carrinho: resposta.dados,
          carrinhos: lista.dados,
          carregando: false,
          erro: null,
        });
      else if (propagarErro && sessao.current === atual) {
        // Uma mutacao antiga pode ter gravado depois da resposta mais recente.
        // Reconsulta o servidor; descartar somente seu JSON deixaria o badge errado.
        await executar(() => api.carrinho.ler(), false);
      }
      return resposta;
    } catch (erro) {
      if (vigente())
        setEstado((e) => ({
          ...e,
          carrinho: erro.status === 401 ? VAZIO : e.carrinho,
          carrinhos: erro.status === 401 ? [] : e.carrinhos,
          carregando: false,
          erro: !propagarErro || erro.status === 401 ? erro : null,
        }));
      if (propagarErro && erro.codigo === 'CARRINHO_ALTERADO' && sessao.current === atual)
        await executar(() => api.carrinho.ler(), false);
      if (propagarErro) throw erro;
    }
  }, []);

  const recarregar = useCallback(() => executar(() => api.carrinho.ler(), false), [executar]);

  useEffect(() => {
    setEstado({
      usuarioId,
      carrinho: VAZIO,
      carrinhos: [],
      carregando: Boolean(usuarioId),
      erro: null,
    });
    if (usuarioId) recarregar();
    return () => {
      sessao.current.requisicao++;
    };
  }, [usuarioId, recarregar]);

  const carrinhoId = estado.usuarioId === usuarioId ? estado.carrinho.id : undefined;
  const adicionar = useCallback(
    (codigo, quantidade = 1) =>
      executar(() => api.carrinho.adicionar(codigo, quantidade, carrinhoId)),
    [executar, carrinhoId],
  );
  const alterar = useCallback(
    (codigo, quantidade) => executar(() => api.carrinho.alterar(codigo, quantidade, carrinhoId)),
    [executar, carrinhoId],
  );
  const remover = useCallback(
    (codigo) => executar(() => api.carrinho.remover(codigo, carrinhoId)),
    [executar, carrinhoId],
  );
  const limpar = useCallback(
    () => executar(() => api.carrinho.limpar(carrinhoId)),
    [executar, carrinhoId],
  );
  const gerenciar = useCallback(
    (acao) =>
      executar(async () => {
        await acao();
        return api.carrinho.ler();
      }),
    [executar],
  );
  const criar = useCallback(
    (nome) =>
      gerenciar(async () => {
        const resposta = await api.carrinhos.criar(nome);
        await api.carrinhos.ativar(resposta.dados.id);
      }),
    [gerenciar],
  );
  const renomear = useCallback(
    (nome) => gerenciar(() => api.carrinhos.renomear(carrinhoId, nome)),
    [gerenciar, carrinhoId],
  );
  const ativar = useCallback((id) => gerenciar(() => api.carrinhos.ativar(id)), [gerenciar]);
  const excluir = useCallback(
    () => gerenciar(() => api.carrinhos.excluir(carrinhoId)),
    [gerenciar, carrinhoId],
  );
  const visivel =
    estado.usuarioId === usuarioId
      ? estado
      : { carrinho: VAZIO, carrinhos: [], carregando: Boolean(usuarioId), erro: null };
  const valor = {
    ...visivel,
    recarregar,
    adicionar,
    alterar,
    remover,
    limpar,
    criar,
    renomear,
    ativar,
    excluir,
  };

  return <CarrinhoContext.Provider value={valor}>{children}</CarrinhoContext.Provider>;
}

export function useCarrinho() {
  const contexto = useContext(CarrinhoContext);
  if (!contexto) throw new Error('useCarrinho precisa estar dentro de <ProvedorCarrinho>.');
  return contexto;
}
