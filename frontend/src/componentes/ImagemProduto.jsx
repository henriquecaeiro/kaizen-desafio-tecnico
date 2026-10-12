import { useEffect, useState } from 'react';
import { CABECALHOS_API } from '../api/cliente.js';

export function ImagemProduto({ src, ...atributos }) {
  const [imagem, setImagem] = useState(null);
  const viaApi = src?.startsWith('/api/imagens/');

  useEffect(() => {
    if (!viaApi) return;
    const controle = new AbortController();
    let leitor;

    // img nao permite headers; data URL conserva a CSP existente e evita o aviso ngrok.
    fetch(src, { headers: CABECALHOS_API, credentials: 'include', signal: controle.signal })
      .then(async resposta => {
        if (!resposta.ok || !resposta.headers.get('content-type')?.startsWith('image/')) throw new Error();
        const dados = await resposta.blob();
        if (controle.signal.aborted) return;
        leitor = new FileReader();
        leitor.onload = () => {
          if (!controle.signal.aborted) setImagem({ src, dados: leitor.result });
        };
        leitor.onerror = () => {
          if (!controle.signal.aborted) setImagem({ src, erro: true });
        };
        leitor.readAsDataURL(dados);
      })
      .catch(() => {
        if (!controle.signal.aborted) setImagem({ src, erro: true });
      });

    return () => { controle.abort(); if (leitor?.readyState === FileReader.LOADING) leitor.abort(); };
  }, [src, viaApi]);

  const atual = imagem?.src === src ? imagem : null;
  return <img {...atributos} src={viaApi ? atual?.dados : src}
    title={atual?.erro ? 'Imagem temporariamente indisponível' : atributos.title} />;
}
