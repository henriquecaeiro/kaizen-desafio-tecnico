import { Link } from 'react-router-dom';
import { dinheiro } from '../api/cliente.js';

export function ItensCarrinho({ itens, ocupado, aoAlterar, aoRemover }) {
  return (
    <ul className="divide-y divide-tinta-200">
      {itens.map((item) => (
        <li key={item.codigo_produto} className="py-4">
          <div className="flex gap-3">
            {item.imagem_url && (
              <img
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
            <label className="sr-only" htmlFor={`qtd-${item.codigo_produto}`}>
              Quantidade de {item.descricao}
            </label>
            <input
              id={`qtd-${item.codigo_produto}`}
              type="number"
              min="1"
              max="99"
              value={item.quantidade}
              disabled={ocupado}
              onChange={(evento) => {
                const valor = Number(evento.target.value);
                if (Number.isInteger(valor) && valor >= 1 && valor <= 99)
                  aoAlterar(item.codigo_produto, valor);
              }}
              className="w-20 rounded-lg border border-tinta-300 px-2 py-1.5 text-sm disabled:bg-tinta-100"
            />
            <button
              type="button"
              disabled={ocupado}
              onClick={() => aoRemover(item.codigo_produto)}
              className="text-sm text-tinta-600 underline hover:text-red-700 disabled:opacity-50"
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
