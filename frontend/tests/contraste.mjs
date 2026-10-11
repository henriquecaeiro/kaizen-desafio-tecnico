// Usa o canvas do navegador para resolver cores oklab/oklch do Tailwind em sRGB.
// Gradientes sao conferidos nos extremos; nao substitui auditoria WCAG completa.
export async function problemasDeContraste(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = cor => {
      ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = cor; ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data].map((n, i) => i === 3 ? n / 255 : n);
    };
    const misturar = (frente, fundo) => frente.slice(0, 3).map((n, i) => n * frente[3] + fundo[i] * (1 - frente[3]));
    const luminancia = cor => cor.reduce((soma, n, i) => {
      const v = n / 255;
      return soma + (v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i];
    }, 0);
    const razao = (a, b) => (Math.max(luminancia(a), luminancia(b)) + .05) / (Math.min(luminancia(a), luminancia(b)) + .05);
    const falhas = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!el.getClientRects().length || el.closest('[aria-hidden="true"]') || ['OPTION', 'SCRIPT', 'STYLE'].includes(el.tagName)) continue;
      const texto = [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent.trim()).join(' ');
      if (!texto) continue;
      const estilo = getComputedStyle(el);
      if (estilo.visibility === 'hidden') continue;
      let fundo = [255, 255, 255]; let opacidade = 1; let gradiente = null;
      const ancestrais = []; for (let atual = el; atual; atual = atual.parentElement) ancestrais.unshift(atual);
      for (const atual of ancestrais) {
        const css = getComputedStyle(atual);
        opacidade *= Number(css.opacity);
        fundo = misturar(rgba(css.backgroundColor), fundo);
        if (css.backgroundImage.includes('gradient')) {
          const cores = css.backgroundImage.match(/(?:rgba?|oklab|oklch|color)\([^)]*\)|#[a-f0-9]{3,8}/gi);
          if (cores?.length) gradiente = cores.map(cor => misturar(rgba(cor), fundo));
        }
      }
      const cor = rgba(estilo.color); cor[3] *= opacidade;
      const fundos = gradiente ?? [fundo];
      const contraste = Math.min(...fundos.map(f => razao(misturar(cor, f), f)));
      const tamanho = Number.parseFloat(estilo.fontSize); const peso = Number.parseInt(estilo.fontWeight, 10);
      const minimo = tamanho >= 24 || (tamanho >= 18.66 && peso >= 700) ? 3 : 4.5;
      if (contraste + .02 < minimo) falhas.push({ texto: texto.slice(0, 70), contraste: Number(contraste.toFixed(2)), minimo });
    }
    return falhas;
  });
}
