import { useEffect, useRef, useState } from 'react';
import { Botao } from './ui.jsx';
import { ConteudoCarrinho } from './ConteudoCarrinho.jsx';

export function PainelCarrinho({ aberto, aoFechar }) {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const dialogo = useRef(null);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const atualizar = () => setDesktop(media.matches);
    media.addEventListener('change', atualizar);
    return () => media.removeEventListener('change', atualizar);
  }, []);
  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (aberto && !desktop) elemento.showModal();
    else elemento.close();
  }, [aberto, desktop]);

  function manterFoco(evento) {
    if (evento.key !== 'Tab') return;
    const elementos = [
      ...dialogo.current.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]:not([aria-disabled="true"])',
      ),
    ].filter((el) => el.getClientRects().length > 0);
    const primeiro = elementos[0];
    const ultimo = elementos.at(-1);
    if (
      (evento.shiftKey && document.activeElement === primeiro) ||
      (!evento.shiftKey && document.activeElement === ultimo)
    ) {
      evento.preventDefault();
      (evento.shiftKey ? ultimo : primeiro)?.focus();
    }
  }

  const conteudo = (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="titulo-painel-carrinho" className="font-semibold text-tinta-900">
          Meu carrinho
        </h2>
        <Botao variante="discreto" tamanho="pequeno" onClick={aoFechar}>
          Fechar painel
        </Botao>
      </div>
      <ConteudoCarrinho compacto />
    </>
  );

  if (desktop)
    return aberto ? (
      <aside
        aria-labelledby="titulo-painel-carrinho"
        className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-xl border border-tinta-200 bg-white p-4"
      >
        {conteudo}
      </aside>
    ) : null;
  return (
    <dialog
      ref={dialogo}
      aria-labelledby="titulo-painel-carrinho"
      onCancel={aoFechar}
      onKeyDown={manterFoco}
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-[390px] overflow-y-auto border-l border-tinta-200 bg-white p-4 text-tinta-800 backdrop:bg-tinta-900/30"
    >
      {aberto && conteudo}
    </dialog>
  );
}
