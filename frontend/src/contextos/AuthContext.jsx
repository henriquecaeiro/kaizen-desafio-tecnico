import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/cliente.js';

const AuthContext = createContext(null);

/**
 * Nao existe token no JavaScript: a sessao vive num cookie httpOnly.
 * Para saber quem esta logado o front pergunta ao servidor (GET /auth/eu) uma
 * vez no boot. E so o servidor pode responder - que e exatamente a intencao.
 */
export function ProvedorAuth({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const versaoSessao = useRef(0);

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
    return resposta.dados;
  }, []);

  const cadastrar = useCallback(async (dados) => {
    const resposta = await api.auth.cadastrar(dados);
    versaoSessao.current++;
    setUsuario(resposta.dados);
    setCarregando(false);
    return resposta.dados;
  }, []);

  const sair = useCallback(async () => {
    try {
      await api.auth.sair();
    } finally {
      // Mesmo se a chamada falhar, o estado local tem que sair do ar logado.
      versaoSessao.current++;
      setUsuario(null);
      setCarregando(false);
    }
  }, []);

  const valor = useMemo(
    () => ({ usuario, carregando, autenticado: usuario !== null, entrar, cadastrar, sair, setUsuario }),
    [usuario, carregando, entrar, cadastrar, sair],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de <ProvedorAuth>.');
  return contexto;
}
