import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/cliente.js';
import { Alerta, Botao } from '../componentes/ui.jsx';

const AuthContext = createContext(null);

/**
 * Nao existe token no JavaScript: a sessao vive num cookie httpOnly.
 * Para saber quem esta logado o front pergunta ao servidor (GET /auth/eu) uma
 * vez no boot. E so o servidor pode responder - que e exatamente a intencao.
 */
export function ProvedorAuth({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erroSessao, setErroSessao] = useState(null);
  const versaoSessao = useRef(0);
  const canal = useRef(null);

  useEffect(() => {
    if (!window.BroadcastChannel) return;
    const comunicacao = new BroadcastChannel('kaizen-sessao');
    canal.current = comunicacao;
    comunicacao.onmessage = async () => {
      // Cookies são compartilhados pelas abas; a identidade é relida no servidor.
      const versao = ++versaoSessao.current;
      setUsuario(null);
      setCarregando(true);
      setErroSessao(null);
      try {
        const resposta = await api.auth.eu();
        if (versaoSessao.current === versao) setUsuario(resposta.dados);
      } catch (falha) {
        // Sem confirmação da sessão nova, não reapresenta dados da conta antiga.
        if (versaoSessao.current === versao && falha.status !== 401) setErroSessao(falha);
      } finally {
        if (versaoSessao.current === versao) setCarregando(false);
      }
    };
    return () => { versaoSessao.current++; comunicacao.close(); canal.current = null; };
  }, []);

  useEffect(() => {
    let ativo = true;
    const versao = versaoSessao.current;
    const vigente = () => ativo && versaoSessao.current === versao;

    api.auth
      .eu()
      .then((resposta) => {
        if (vigente()) setUsuario(resposta.dados);
      })
      .catch(() => {
        // 401 aqui e o caso normal de visitante sem sessao.
        if (vigente()) setUsuario(null);
      })
      .finally(() => {
        if (vigente()) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const entrar = useCallback(async (credenciais) => {
    const resposta = await api.auth.entrar(credenciais);
    // A leitura de sessao iniciada no boot pode terminar depois deste login.
    versaoSessao.current++;
    setUsuario(resposta.dados);
    setCarregando(false);
    setErroSessao(null);
    canal.current?.postMessage('sessao-alterada');
    return resposta.dados;
  }, []);

  const cadastrar = useCallback(async (dados) => {
    const resposta = await api.auth.cadastrar(dados);
    versaoSessao.current++;
    setUsuario(resposta.dados);
    setCarregando(false);
    setErroSessao(null);
    canal.current?.postMessage('sessao-alterada');
    return resposta.dados;
  }, []);

  const sair = useCallback(async () => {
    await api.auth.sair();
    versaoSessao.current++;
    setUsuario(null);
    setCarregando(false);
    setErroSessao(null);
    canal.current?.postMessage('sessao-alterada');
  }, []);

  const atualizarUsuario = useCallback((dados) => {
    // Uma resposta de perfil antiga nao pode restaurar uma conta que ja saiu.
    setUsuario(atual => atual?.id === dados.id ? dados : atual);
  }, []);

  const valor = useMemo(
    () => ({ usuario, carregando, autenticado: usuario !== null, entrar, cadastrar, sair, atualizarUsuario }),
    [usuario, carregando, entrar, cadastrar, sair, atualizarUsuario],
  );

  return <AuthContext.Provider value={valor}>
    {erroSessao && <Alerta titulo="Não foi possível atualizar a sessão" className="m-4">
      {erroSessao.message}{' '}
      <Botao variante="contorno" tamanho="pequeno" onClick={() => window.location.reload()}>Recarregar página</Botao>
    </Alerta>}
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de <ProvedorAuth>.');
  return contexto;
}
