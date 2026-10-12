import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { config, emProducao } from './config.js';
import { obterBanco } from './db/index.js';
import { verificarErp } from './erp/cliente.js';
import { rotaNaoEncontrada, tratarErros } from './middleware/erros.js';
import { identificarRequisicao, registrarAcesso } from './middleware/requisicao.js';
import { rotasAuth } from './routes/auth.js';
import { rotasCarrinho } from './routes/carrinho.js';
import { rotasCarrinhos } from './routes/carrinhos.js';
import { rotasCatalogo } from './routes/catalogo.js';
import { rotasEnderecos } from './routes/enderecos.js';
import { rotasImagens } from './routes/imagens.js';
import { rotasPedidos } from './routes/pedidos.js';
import { rotasPerfil } from './routes/perfil.js';
import { ApiError } from './lib/ApiError.js';

export function criarApp() {
  const app = express();

  app.set('trust proxy', config.proxiesConfiaveis.length ? config.proxiesConfiaveis : false);
  app.disable('x-powered-by');

  app.use(identificarRequisicao);
  app.use(registrarAcesso);
  // Sessao, dados pessoais e estoque nao podem ser reutilizados por caches de proxy.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  });
  // Mesma origem e o caminho normal. A lista explicita tambem impede mutacoes
  // de origens nao autorizadas; CORS sozinho apenas controla leitura no browser.
  app.use(cors({
    origin(origem, callback) {
      if (!origem) return callback(null, false);
      if (config.corsOrigens.includes(origem)) return callback(null, origem);
      callback(new ApiError(403, 'ORIGEM_NAO_PERMITIDA', 'Origem da requisicao nao permitida.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Carrinho-Id', 'X-Request-Id'],
  }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (emProducao) {
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    }
    next();
  });
  app.use(express.json({ limit: '128kb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    obterBanco().prepare('SELECT 1').get();

    res.json({
      status: 'ok',
      ambiente: config.ambiente,
      erp: await verificarErp(),
      uptime_s: Math.round(process.uptime()),
      horario: new Date().toISOString(),
    });
  });

  // Publicas: da para navegar na loja sem conta.
  app.use('/api/catalogo', rotasCatalogo);
  app.use('/api/imagens', rotasImagens);
  app.use('/api/auth', rotasAuth);

  // Exigem sessao (o autenticar fica dentro de cada router).
  app.use('/api/perfil', rotasPerfil);
  app.use('/api/enderecos', rotasEnderecos);
  app.use('/api/carrinho', rotasCarrinho);
  app.use('/api/carrinhos', rotasCarrinhos);
  app.use('/api/pedidos', rotasPedidos);

  /**
   * Em producao o backend tambem entrega o front ja buildado. Uma porta so,
   * sem CORS e sem nginx precisando rotear dois upstreams.
   */
  const distFront = path.resolve(config.raizProjeto, '../frontend/dist');

  if (emProducao && fs.existsSync(distFront)) {
    app.use(express.static(distFront, { index: false, maxAge: '1h' }));

    // Fallback do React Router: qualquer caminho que nao seja /api devolve o
    // index.html para o roteamento acontecer no navegador.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path === '/api' || req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distFront, 'index.html'));
    });
  }

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);

  return app;
}
