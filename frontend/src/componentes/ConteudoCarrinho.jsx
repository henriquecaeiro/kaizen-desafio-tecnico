import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dinheiro } from '../api/cliente.js';
import { useCarrinho } from '../contextos/CarrinhoContext.jsx';
import { Alerta, Botao, Carregando } from './ui.jsx';
import { GerenciadorCarrinhos } from './GerenciadorCarrinhos.jsx';
import { ItensCarrinho } from './ItensCarrinho.jsx';

export function ConteudoCarrinho({ compacto = false }) {
  const {
    carrinho,
    carregando,
    erro: erroCarga,
    recarregar,
    alterar,
    remover,
    limpar,
  } = useCarrinho();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);
  const navegar = useNavigate();
  const ativo = useRef(carrinho.id);
  ativo.current = carrinho.id;
  useEffect(() => {
    setErro(null);
    setConfirmarLimpeza(false);
  }, [carrinho.id]);
  const ocupado = carregando || enviando;
  const bloqueado = ocupado || Boolean(carrinho.checkout_estado);

  async function executar(acao) {
    const id = carrinho.id;
    setEnviando(true);
    setErro(null);
    try {
      await acao();
      return true;
    } catch (falha) {
      if (ativo.current === id) setErro(falha);
      return false;
    } finally {
      setEnviando(false);
    }
  }
  return (
    <div className="space-y-4" aria-busy={ocupado}>
      <GerenciadorCarrinhos executar={executar} ocupado={ocupado} />
      {(erro || erroCarga) && (
        <Alerta titulo={erroCarga ? 'Não foi possível carregar o carrinho' : undefined}>
          {(erroCarga || erro).message}{' '}
          {erroCarga && carrinho.itens.length > 0 &&
            <p className="mt-1">Itens preservados. Preços e estoque aguardam atualização.</p>}
          <Botao variante="contorno" tamanho="pequeno" onClick={() => { setErro(null); recarregar(); }} disabled={ocupado}>
            Tentar novamente
          </Botao>
        </Alerta>
      )}
      {carregando && <Carregando texto="Carregando carrinho..." className="py-3" />}
      {carrinho.checkout_estado && (
        <Alerta tipo="aviso">
          {carrinho.checkout_estado === 'INCERTO'
            ? 'O resultado do pedido precisa ser conferido pela loja. Não repita a compra; seus itens foram preservados.'
            : 'Este carrinho está fechando um pedido. Aguarde para alterar os itens.'}
        </Alerta>
      )}
      {!erroCarga && !carregando && carrinho.itens.length === 0 && (
        <p className="py-6 text-center text-sm text-tinta-600">Seu carrinho está vazio</p>
      )}
      {carrinho.itens.length > 0 && (
        <div className={compacto ? 'space-y-4' : 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]'}>
          <div className="min-w-0 rounded-lg border border-tinta-200 bg-white px-4">
            <p className="pt-3 text-xs text-tinta-600">Confirme a quantidade com Enter ou ao sair do campo.</p>
            <ItensCarrinho
              key={carrinho.id}
              itens={carrinho.itens}
              ocupado={bloqueado}
              quantidadeBloqueada={Boolean(carrinho.checkout_estado)}
              aoAlterar={(codigo, quantidade) => executar(() => alterar(codigo, quantidade))}
              aoRemover={(codigo) => executar(() => remover(codigo))}
            />
          </div>
          <div className="space-y-3 rounded-lg border border-tinta-200 bg-white p-4">
            <p className="text-sm text-tinta-600">
              {carrinho.quantidade_itens} {carrinho.quantidade_itens === 1 ? 'produto' : 'produtos'}{' '}
              · {carrinho.quantidade_pecas} {carrinho.quantidade_pecas === 1 ? 'peça' : 'peças'}
            </p>
            <div className="flex justify-between gap-2 font-semibold">
              <span>Total elegível</span>
              <span>{dinheiro.format(carrinho.valor_total)}</span>
            </div>
            {!carrinho.pronto_para_checkout && (
              <Alerta tipo="aviso">
                Ajuste ou remova os itens com pendência antes de fechar o pedido.
              </Alerta>
            )}
            <Botao
              className="w-full"
              disabled={bloqueado || Boolean(erroCarga) || !carrinho.pronto_para_checkout}
              onClick={() => navegar('/checkout')}
            >
              Fechar pedido
            </Botao>
            <Botao
              variante="discreto"
              tamanho="pequeno"
              disabled={bloqueado}
              onClick={() => setConfirmarLimpeza(true)}
            >
              Esvaziar
            </Botao>
            {confirmarLimpeza && (
              <div className="space-y-2 text-sm">
                <p>Remover todos os itens deste carrinho?</p>
                <Botao
                  variante="perigo"
                  tamanho="pequeno"
                  disabled={bloqueado}
                  onClick={async () => {
                    if (await executar(limpar)) setConfirmarLimpeza(false);
                  }}
                >
                  Confirmar limpeza
                </Botao>
                <Botao
                  variante="discreto"
                  tamanho="pequeno"
                  onClick={() => setConfirmarLimpeza(false)}
                >
                  Cancelar
                </Botao>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
