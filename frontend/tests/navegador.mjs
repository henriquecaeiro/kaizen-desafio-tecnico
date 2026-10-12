import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepararAmbiente } from '../../backend/test-support/ambiente.mjs';

let diretorioCapturas;
export async function caminhoCaptura(nome) {
  diretorioCapturas ??= process.env.EVIDENCIAS_DIR
    ? mkdir(path.resolve(process.env.EVIDENCIAS_DIR), { recursive: true }).then(() => path.resolve(process.env.EVIDENCIAS_DIR))
    : mkdtemp(path.join(tmpdir(), 'kaizen-capturas-'));
  return path.join(await diretorioCapturas, nome);
}

export async function abrirNavegador() {
  const e = await prepararAmbiente();
  const vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, proxy: { '/api': { target: e.base, changeOrigin: true } } } });
  await vite.listen();
  const base = `http://127.0.0.1:${vite.httpServer.address().port}`;
  e.config.corsOrigens.push(base);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  const erros = [];
  page.on('pageerror', erro => erros.push(erro.message));
  // Navegador tambem nao pode escrever em servicos externos.
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.fallback() : route.abort());
  async function entrar(nome = 'a') {
    // URL distinta evita reutilizar history.state do redirecionamento de uma rota protegida.
    await page.goto(`${base}/entrar?teste-login`);
    await page.getByLabel('E-mail').fill(`${nome}@example.test`);
    await page.getByLabel('Senha', { exact: true }).fill('TesteLocal123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL(base + '/');
  }
  async function fechar() {
    await Promise.all(context.pages().map(pagina => pagina.unrouteAll({ behavior: 'wait' })));
    await context.unrouteAll({ behavior: 'wait' });
    await browser.close(); await vite.close(); await e.fechar();
  }
  return { ...e, page, context, browser, base, entrar, erros, fechar };
}

export async function esperar(assertiva) {
  const fim = Date.now() + 5000;
  for (;;) {
    try { return await assertiva(); } catch (erro) {
      if (Date.now() >= fim) throw erro;
      await new Promise(r => setTimeout(r, 30));
    }
  }
}
