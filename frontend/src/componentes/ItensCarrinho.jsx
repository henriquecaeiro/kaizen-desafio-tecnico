import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { dinheiro } from '../api/cliente.js';
import { ImagemProduto } from './ImagemProduto.jsx';

function Quantidade({ item, ocupado, aoAlterar }) {
  const [valor, setValor] = useState(String(item.quantidade));
  const [erro, setErro] = useState(null);
  const editando = useRef(false);
  const salvando = useRef(false);
  const confirmarPendente = useRef(false);
  const rascunho = useRef(valor);
  const confirmado = useRef(item.quantidade);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);
  useEffect(() => {
    confirmado.current = item.quantidade;
    if (!editando.current && !salvando.current) {
      rascunho.current = String(item.quantidade);
      setValor(rascunho.current);
    }
  }, [item.quantidade]);

  async function confirmar() {
    if (!montado.current) return;
    if (salvando.current) { confirmarPendente.current = true; return; }
    confirmarPendente.current = false;
    const texto = rascunho.current;
    const quantidade = Number(texto);
    if (!/^\d+$/.test(texto) || quantidade < 1 || quantidade > 99) {
      setErro('Informe uma quantidade inteira de 1 a 99.');
      rascunho.current = String(confirmado.current);
      setValor(rascunho.current);
      return;
    }
    if (quantidade === confirmado.current) return;
    salvando.current = true;
    setErro(null);
    const sucesso = await aoAlterar(item.codigo_produto, quantidade);
    salvando.current = false;
    if (!montado.current) return;
    if (sucesso) confirmado.current = quantidade;
    // Preserva uma nova edição feita enquanto a gravação estava em andamento.
    if (rascunho.current === texto) {
      rascunho.current = String(confirmado.current);
      setValor(rascunho.current);
    } else if (!editando.current || confirmarPendente.current) {
      await confirmar();
    }
  }

  return <div>
    <label className="sr-only" htmlFor={`qtd-${item.codigo_produto}`}>
      Quantidade de {item.descricao}
    </label>
    <input
      id={`qtd-${item.codigo_produto}`} type="number" min="1" max="99" step="1"
      inputMode="numeric" value={valor} disabled={ocupado}
      aria-invalid={erro ? 'true' : undefined}
      aria-describedby={erro ? `qtd-${item.codigo_produto}-erro` : undefined}
      onFocus={() => { editando.current = true; }}
      onChange={(evento) => {
        rascunho.current = evento.target.value;
        setValor(evento.target.value);
        setErro(null);
      }}
      onBlur={() => { editando.current = false; confirmar(); }}
      onKeyDown={(evento) => {
        if (evento.key === 'Enter') { evento.preventDefault(); confirmar(); }
      }}
      className="w-20 rounded-lg border border-tinta-300 px-2 py-1.5 text-sm disabled:bg-tinta-100"
    />
    {erro && <p role="alert" id={`qtd-${item.codigo_produto}-erro`} className="mt-1 text-xs text-red-700">{erro}</p>}
  </div>;
}

export function ItensCarrinho({ itens, ocupado, quantidadeBloqueada, aoAlterar, aoRemover }) {
  return (
    <ul className="divide-y divide-tinta-200">
      {itens.map((item) => (
        <li key={item.codigo_produto} className="py-4">
          <div className="flex gap-3">
            {item.imagem_url && (
              <ImagemProduto
                src={item.imagem_url}
                alt=""
                width="56"
                height="56"
                className="size-14 shrink-0 rounded-lg bg-tinta-100 object-contain p-1"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase text-marca-700">{item.marca}</p>
              <h3 className="break-words text-sm font-semibold text-tinta-900">
                <Link
                  to={`/produto/${encodeURIComponent(item.codigo_produto)}`}
                  className="hover:underline"
                >
                  {item.descricao}
                </Link>
              </h3>
              <p className="mt-1 text-xs text-tinta-600">
                {item.codigo_produto} · {dinheiro.format(item.preco_unitario)} cada
              </p>
            </div>
          </div>
          {item.problema && (
            <p className="mt-2 text-xs font-medium text-amber-700">{item.problema}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Quantidade item={item} ocupado={quantidadeBloqueada} aoAlterar={aoAlterar} />
            <button
              type="button"
              disabled={ocupado}
              onClick={() => aoRemover(item.codigo_produto)}
              className="min-h-8 px-1 text-sm text-tinta-600 underline hover:text-red-700 disabled:opacity-50"
            >
              Remover
            </button>
            <p className="ml-auto text-right text-sm font-semibold text-tinta-900">
              {dinheiro.format(item.valor_total)}
              {!item.disponivel && (
                <span className="block text-xs font-normal text-amber-700">Fora do total</span>
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
