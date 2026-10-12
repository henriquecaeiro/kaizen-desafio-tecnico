export function onPreBuild({ netlifyConfig, utils }) {
  let origem;
  try {
    const url = new URL(process.env.NGROK_URL);
    const dominios = ['ngrok-free.app', 'ngrok-free.dev', 'ngrok.app', 'ngrok.io'];
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        url.pathname !== '/' || url.search || url.hash ||
        !dominios.some(dominio => url.hostname.endsWith(`.${dominio}`))) throw new Error();
    origem = url.origin;
  } catch {
    return utils.build.failBuild('Configure NGROK_URL com a origem HTTPS real do tunel ngrok, sem caminho ou credenciais.');
  }

  // A API nunca deve cair no fallback SPA, mesmo que exista arquivo no caminho.
  netlifyConfig.redirects = [{
    from: '/api/*', to: `${origem}/api/:splat`, status: 200, force: true,
    headers: { 'ngrok-skip-browser-warning': '1' },
  }, ...netlifyConfig.redirects.filter(regra => regra.from !== '/api/*')];
}
