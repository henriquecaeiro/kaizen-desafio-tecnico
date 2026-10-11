import { useEffect, useState } from 'react';
import { useCarrinho } from '../contextos/CarrinhoContext.jsx';
import { Botao, Campo } from './ui.jsx';

export function GerenciadorCarrinhos({ executar, ocupado }) {
  const { carrinho, carrinhos, criar, renomear, ativar, excluir } = useCarrinho();
  const [modo, setModo] = useState(null);
  const [nome, setNome] = useState('');
  useEffect(() => {
    setModo(null);
  }, [carrinho.id]);

  function editar(acao) {
    setNome(acao === 'renomear' ? carrinho.nome : '');
    setModo(acao);
  }
  async function salvar(evento) {
    evento.preventDefault();
    const sucesso = await executar(() =>
      modo === 'criar' ? criar(nome.trim()) : renomear(nome.trim()),
    );
    if (sucesso) setModo(null);
  }

  return (
    <section className="space-y-3" aria-label="Gerenciar carrinhos">
      <label className="block text-sm font-medium text-tinta-700" htmlFor="carrinho-ativo">
        Carrinho ativo
      </label>
      <select
        id="carrinho-ativo"
        value={carrinho.id ?? ''}
        disabled={ocupado}
        onChange={(evento) => executar(() => ativar(Number(evento.target.value)))}
        className="w-full min-w-0 rounded-lg border border-tinta-300 bg-white px-3 py-2.5 text-sm"
      >
        {!carrinho.id && <option value="">Carregando...</option>}
        {carrinhos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome} ({c.quantidade_pecas})
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-1">
        <Botao
          variante="contorno"
          tamanho="pequeno"
          disabled={ocupado || carrinhos.length >= 10}
          onClick={() => editar('criar')}
        >
          Novo carrinho
        </Botao>
        <Botao
          variante="discreto"
          tamanho="pequeno"
          disabled={ocupado || !carrinho.id}
          onClick={() => editar('renomear')}
        >
          Renomear
        </Botao>
        <Botao
          variante="discreto"
          tamanho="pequeno"
          disabled={ocupado || !carrinho.id || Boolean(carrinho.checkout_estado)}
          onClick={() => setModo('excluir')}
        >
          Excluir
        </Botao>
      </div>
      {carrinhos.length >= 10 && (
        <p className="text-xs text-tinta-600">Limite de 10 carrinhos atingido.</p>
      )}
      {(modo === 'criar' || modo === 'renomear') && (
        <form
          onSubmit={salvar}
          className="space-y-3 rounded-lg border border-tinta-200 bg-tinta-50 p-3"
        >
          <Campo
            rotulo="Nome do carrinho"
            name="nome-carrinho"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            maxLength={80}
            required
            autoFocus
          />
          <div className="flex gap-2">
            <Botao tamanho="pequeno" type="submit" disabled={ocupado || !nome.trim()}>
              Salvar carrinho
            </Botao>
            <Botao
              variante="discreto"
              tamanho="pequeno"
              type="button"
              disabled={ocupado}
              onClick={() => setModo(null)}
            >
              Cancelar
            </Botao>
          </div>
        </form>
      )}
      {modo === 'excluir' && (
        <div className="space-y-2 rounded-lg border border-tinta-200 bg-tinta-50 p-3">
          <p className="break-words text-sm">Excluir “{carrinho.nome}” e seus itens?</p>
          <div className="flex gap-2">
            <Botao
              variante="perigo"
              tamanho="pequeno"
              disabled={ocupado}
              onClick={async () => {
                if (await executar(excluir)) setModo(null);
              }}
            >
              Confirmar exclusão
            </Botao>
            <Botao
              variante="discreto"
              tamanho="pequeno"
              disabled={ocupado}
              onClick={() => setModo(null)}
            >
              Cancelar
            </Botao>
          </div>
        </div>
      )}
    </section>
  );
}
