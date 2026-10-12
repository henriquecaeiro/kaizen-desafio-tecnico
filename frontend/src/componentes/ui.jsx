import { useLayoutEffect, useRef, useState } from 'react';
import { digitos, formatarMascara, posicaoPorDigitos } from '../lib/mascaras.js';

/**
 * Primitivos de interface da loja.
 * Ficam juntos de proposito: sao pequenos, usados em toda tela, e manter o
 * estilo num arquivo so evita que cada pagina invente seu proprio botao.
 */

/**
 * Botao desabilitado troca TAMBEM a cor do texto. Manter `text-white` sobre um
 * fundo claro deixaria o rotulo ilegivel - e o estado desabilitado precisa
 * continuar legivel para a pessoa entender o que esta bloqueado.
 *
 * O WCAG 1.4.3 isenta componente desabilitado da regra de contraste, mas
 * "isento" nao e desculpa para ninguem conseguir ler. Os tons aqui ficam
 * apagados o suficiente para parecerem inativos e escuros o suficiente para
 * serem lidos.
 */
const ESTILOS_BOTAO = {
  primario: 'bg-marca-700 text-white hover:bg-marca-800 disabled:bg-tinta-200 disabled:text-tinta-600',
  secundario: 'bg-tinta-800 text-white hover:bg-tinta-900 disabled:bg-tinta-200 disabled:text-tinta-600',
  contorno: 'border border-tinta-300 bg-white text-tinta-700 hover:bg-tinta-50 disabled:text-tinta-500',
  discreto: 'text-tinta-600 hover:bg-tinta-100 disabled:text-tinta-500',
  perigo: 'border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:border-tinta-200 disabled:text-tinta-600',
};

const TAMANHOS_BOTAO = {
  pequeno: 'px-3 py-1.5 text-sm',
  medio: 'px-4 py-2.5 text-sm',
  grande: 'px-6 py-3 text-base',
};

export function Botao({
  variante = 'primario',
  tamanho = 'medio',
  carregando = false,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      {...props}
      aria-busy={carregando || undefined}
      disabled={props.disabled || carregando}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold
        transition-colors disabled:cursor-not-allowed
        ${ESTILOS_BOTAO[variante]} ${TAMANHOS_BOTAO[tamanho]} ${className}`}
    >
      {carregando && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

export function Campo({ rotulo, erro, dica, id, className = '', children, mascara, ...props }) {
  const [visivel, setVisivel] = useState(false);
  const input = useRef(null);
  const cursor = useRef(null);
  const senha = props.type === 'password';
  const valor = mascara ? formatarMascara(props.value, mascara) : props.value;
  useLayoutEffect(() => {
    if (cursor.current !== null && input.current === document.activeElement) {
      input.current.setSelectionRange(cursor.current, cursor.current);
      cursor.current = null;
    }
  });
  function mudar(evento) {
    if (!mascara) return props.onChange?.(evento);
    const original = evento.target.value;
    const posicao = evento.target.selectionStart ?? original.length;
    let numeros = digitos(original);
    let antes = digitos(original.slice(0, posicao)).length;
    // Apagar só um separador também apaga o dígito vizinho, sem prender o cursor.
    if (numeros === digitos(valor) && evento.nativeEvent.inputType?.startsWith('delete')) {
      const indice = evento.nativeEvent.inputType === 'deleteContentBackward' ? antes - 1 : antes;
      if (indice >= 0) {
        numeros = numeros.slice(0, indice) + numeros.slice(indice + 1);
        antes = indice;
      }
    }
    const formatado = formatarMascara(numeros, mascara);
    cursor.current = posicao === original.length ? formatado.length : posicaoPorDigitos(formatado, antes);
    evento.target.value = formatado;
    props.onChange?.(evento);
  }
  const idCampo = id ?? props.name;
  const idErro = erro ? `${idCampo}-erro` : undefined;
  const idDica = !erro && dica ? `${idCampo}-dica` : undefined;

  return (
    <div className={className}>
      <label htmlFor={idCampo} className="mb-1.5 block text-sm font-medium text-tinta-700">
        {rotulo}
      </label>

      {children ?? (
        <div className="relative">
        <input
          {...props}
          ref={input}
          type={senha && visivel ? 'text' : props.type}
          value={valor}
          onChange={mudar}
          inputMode={mascara ? 'numeric' : props.inputMode}
          id={idCampo}
          aria-invalid={erro ? 'true' : undefined}
          aria-describedby={idErro ?? idDica}
          className={`w-full rounded-lg border px-3 py-2.5 text-sm text-tinta-900 ${senha ? 'pr-24' : ''}
            placeholder:text-tinta-400 focus:outline-none focus:ring-2
            ${erro
              ? 'border-red-400 bg-red-50 focus:ring-red-200'
              : 'border-tinta-300 bg-white focus:border-marca-500 focus:ring-marca-100'}`}
        />
        {senha && <button type="button" aria-label={`${visivel ? 'Ocultar' : 'Mostrar'} ${rotulo.toLowerCase()}`}
          aria-pressed={visivel} onClick={() => setVisivel(atual => !atual)}
          className="absolute inset-y-0 right-1 min-w-20 rounded px-2 text-sm font-medium text-marca-700 hover:bg-marca-50">
          {visivel ? 'Ocultar' : 'Mostrar'}
        </button>}
        </div>
      )}

      {erro && (
        <p id={idErro} className="mt-1.5 text-sm text-red-600">
          {erro}
        </p>
      )}
      {!erro && dica && <p id={idDica} className="mt-1.5 text-xs text-tinta-500">{dica}</p>}
    </div>
  );
}

const ESTILOS_ALERTA = {
  erro: 'border-red-200 bg-red-50 text-red-800',
  sucesso: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  aviso: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-tinta-200 bg-tinta-100 text-tinta-700',
};

export function Alerta({ tipo = 'erro', titulo, children, className = '' }) {
  return (
    <div
      role={tipo === 'erro' ? 'alert' : 'status'}
      className={`rounded-lg border px-4 py-3 text-sm ${ESTILOS_ALERTA[tipo]} ${className}`}
    >
      {titulo && <p className="font-semibold">{titulo}</p>}
      {children}
    </div>
  );
}

/** Lista os erros de validacao que nao casaram com nenhum input da tela. */
export function ErroGeral({ erro, camposConhecidos = [] }) {
  if (!erro) return null;

  const porCampo = erro.porCampo ?? {};
  const sobrando = Object.entries(porCampo).filter(([campo]) => !camposConhecidos.includes(campo));
  const detalhesLivres = Array.isArray(erro.detalhes)
    ? erro.detalhes.filter((item) => !item?.campo)
    : [];

  return (
    <Alerta tipo="erro" titulo={erro.message}>
      {(sobrando.length > 0 || detalhesLivres.length > 0) && (
        <ul className="mt-1 list-inside list-disc">
          {sobrando.map(([campo, mensagem]) => (
            <li key={campo}>
              {campo}: {mensagem}
            </li>
          ))}
          {detalhesLivres.map((item, indice) => (
            <li key={indice}>
              {item.codigo_produto ? `${item.codigo_produto}: ` : ''}
              {item.mensagem ?? item.motivo}
              {item.estoque_disponivel !== undefined && ` (disponivel: ${item.estoque_disponivel})`}
            </li>
          ))}
        </ul>
      )}
    </Alerta>
  );
}

export function Carregando({ texto = 'Carregando...', className = '' }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-3 py-16 text-tinta-500 ${className}`}>
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-tinta-300 border-t-marca-600"
      />
      <span className="text-sm">{texto}</span>
    </div>
  );
}

export function EstadoVazio({ titulo, descricao, acao }) {
  return (
    <div className="rounded-xl border border-dashed border-tinta-300 bg-white px-6 py-16 text-center">
      <p className="text-lg font-semibold text-tinta-800">{titulo}</p>
      {descricao && <p className="mx-auto mt-2 max-w-md text-sm text-tinta-500">{descricao}</p>}
      {acao && <div className="mt-6 flex justify-center">{acao}</div>}
    </div>
  );
}

const ESTILOS_SELO = {
  ABERTO: 'bg-sky-100 text-sky-800',
  FATURADO: 'bg-emerald-100 text-emerald-800',
  CANCELADO: 'bg-red-100 text-red-800',
  INDISPONIVEL: 'bg-tinta-200 text-tinta-600',
};

export function SeloSituacao({ situacao }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold
        ${ESTILOS_SELO[situacao] ?? ESTILOS_SELO.INDISPONIVEL}`}
    >
      {situacao === 'INDISPONIVEL' ? 'status indisponível' : situacao.toLowerCase()}
    </span>
  );
}

export function Paginacao({ paginacao, aoMudar }) {
  if (!paginacao || paginacao.total_paginas <= 1) return null;

  const { pagina, total_paginas: totalPaginas, total } = paginacao;

  return (
    <nav className="flex items-center justify-between gap-4 pt-4" aria-label="Paginacao">
      <p className="text-sm text-tinta-500">
        Página {pagina} de {totalPaginas} · {total} {total === 1 ? 'resultado' : 'resultados'}
      </p>

      <div className="flex gap-2">
        <Botao
          variante="contorno"
          tamanho="pequeno"
          disabled={pagina <= 1}
          onClick={() => aoMudar(pagina - 1)}
        >
          Anterior
        </Botao>
        <Botao
          variante="contorno"
          tamanho="pequeno"
          disabled={pagina >= totalPaginas}
          onClick={() => aoMudar(pagina + 1)}
        >
          Próxima
        </Botao>
      </div>
    </nav>
  );
}
