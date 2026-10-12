# Validação da entrega — 12/10/2026

Resultados se referem ao código executado, com SQLite descartável e ERP HTTP em
loopback. Os testes bloqueiam acesso externo. Nenhum pedido real foi enviado.

## Resultado e ambiente

Baseline histórico: 131 backend + 39 frontend = 170 aprovados. As validações
anteriores de 76 e 165 casos estão consolidadas no RELATORIO e no histórico Git.
Logs e capturas históricos foram retirados da árvore atual; continuam recuperáveis
no histórico, sem alteração de autoria ou evidências de execução.

A regressão consolidada aprovou **139 backend + 64 frontend = 203 testes** em
Node 24.21.0, com **203 aprovados, zero falhas, cancelamentos e skips**. Isso
representa 33 casos adicionais ao baseline. Frontend inclui seis unitários de
máscaras e 58 cenários executados em Chromium. Após os merges na main, a suíte
completa foi executada novamente em Node 20.19.2: **139+64=203 aprovados**, zero
falhas/cancelamentos/skips. Build, smoke, scanner e auditorias também passaram
nessa execução; registrar esses resultados não alterou código ou testes.

Node 24.21.0 corresponde à .nvmrc. Runtime obtido da distribuição oficial com
SHA-256 conferido, npm ci dos dois lockfiles em cópia isolada, sem alterar o
Node/dependências do usuário. Os 103 arquivos de código/testes/configuração da
cópia foram comparados byte a byte com o workspace, sem divergências.

| Verificação final | Resultado |
|---|---|
| Backend completo | 139/139, Node 20.19.2 e 24.21.0 |
| Frontend completo | 64/64 nos dois runtimes, Chromium com aplicação real e ERP mock |
| Build | Aprovado, Vite 7.3.7, 63 módulos |
| Smoke production | Aprovado; inclui persistência após reinício, zero pedidos |
| Auditorias npm | Zero vulnerabilidades conhecidas, backend e frontend |
| Scanner de segredos | Nenhum segredo/banco identificado; arquivos e histórico |
| Sintaxe e whitespace | node --check e git diff --check aprovados |
| Documentação | Links locais válidos e enunciado original preservado |
| Serviço | systemd-analyze verify aprovado; Caddyfile preservado, sem nova validação do Caddy nesta revisão |

Os resultados acima resumem as execuções anteriores. Saídas brutas continuam
recuperáveis no histórico Git; os comandos abaixo permitem repetir a validação.

## Cobertura e navegação realmente executada

| Área | Verificação |
|---|---|
| Conta | Cadastro pela interface, máscaras, confirmação vazia/diferente/igual, visibilidade por botão/teclado, espaços/especiais, falha de API, sucesso e novo login |
| Perfil | Dados antigos formatados, telefone salvo/limpo, CEP criado/editado, senha atual validada, confirmação, nova senha e revogação de sessão anterior |
| Catálogo | Busca após paginação, filtros/disponibilidade, limpeza, histórico/refresh, última página, respostas fora de ordem e recuperação de 502 |
| Carrinhos | Dois orçamentos com produtos diferentes, criação/renomeação/exclusão/ativação, persistência após refresh e isolamento de usuário |
| Quantidade | Apagar/substituir, Enter/Tab/blur, limites/inválidos, setas de teclado, cliques nas setas nativas repetidos na página/painel, foco, resposta lenta, nova edição durante gravação e falha ao salvar |
| Abas | Duas páginas no mesmo contexto Chromium: login/logout propagados; troca de ativo durante leitura lenta; conjunto carrinho/lista coerente |
| Checkout | Dois endereços criados na interface, secundário selecionado, entrega conferida no payload ERP mock/snapshot; somente carrinho utilizado é limpo |
| Chamados | KZN-312: indisponível fora do total; KZN-318: soma de unidades; KZN-325: busca reinicia página; KZN-331: endereço escolhido enviado |
| Falhas | Backend desconectado, ERP lento/timeout/401/429/502/503/504/JSON inválido, retorno após erro, sessão expirada e itens preservados |
| Backend completo | Contas, sessões, perfil/endereço, migrações/rollback, isolamento, dinheiro/estoque, concorrência, checkout incerto, processos interrompidos, backup/restauração, CORS/proxy, rate limit e scanner |
| Responsividade | 360/390/768/1440 px, dez telas, overflow, controles, máscaras/inputMode, senhas, drawer e checkout; contraste medido no render |

Jornada completa e chamados em frontend/tests/jornada.test.mjs; máscaras/senhas
em formularios.test.mjs e mascaras.test.mjs; quantidades em quantidade.test.mjs;
abas/falhas em confiabilidade.test.mjs. Demais suítes continuam sendo executadas
integralmente. Sessões/carrinhos/catálogo também têm barreiras para respostas
retidas, liberadas e invertidas, sem depender de sleeps arbitrários.

As capturas fictícias de painel/produto nas quatro larguras e as três reproduções
originais foram removidas da árvore atual. Causas, correções e cobertura permanecem
neste documento e no RELATORIO; as imagens históricas não representam pedidos reais.

## Comandos reproduzíveis

```sh
cd backend
npm ci
npm test
node scripts/verificar-segredos.mjs
npm audit --omit=dev
cd ../frontend
npm ci
npm test
npm run build
npm audit
cd ../backend
node scripts/smoke-producao.mjs
cd ..
git diff --check
```

Smoke inicia src/server.js em production com banco temporário e ERP mock;
verifica HTML/assets, fallback SPA, health/catálogo, CSP/nosniff, 404, cookies
Secure/HttpOnly/Lax, CORS, login/logout, carrinhos e persistência após reinício.
Não cria pedidos. Capturas opcionais no frontend:
`CAPTURAR_EVIDENCIAS=true EVIDENCIAS_DIR=/tmp/kaizen-capturas npm test`.
Sem destino explícito, as capturas usam uma pasta temporária do sistema.

## Diagnóstico externo e limitações

GETs autorizados ao SIAC configurado em 12/10: /health 200/status ok (561 ms),
/produtos com tamanho=1 200 (886 ms), /produtos/categorias 200/nove registros
(99 ms). Timeout mantido em 8000 ms. Não reproduzi instabilidade nessas três
leituras; isso não demonstra sua ausência. Nenhum POST externo foi realizado.

Recuperação de senha não implementada: e-mail único identifica conta; documento
não é único nem secreto. Não há serviço de envio/canal de prova de identidade.
A troca autenticada exige senha atual e revoga sessões. Dependências de um fluxo
seguro futuro estão no RELATORIO; nenhum endpoint de recuperação por CPF existe.

Não executados: implantação pública/HTTPS no destino, dispositivos físicos,
Safari/Firefox, gerenciador real de senhas, leitor de tela, carga de produção,
restauração do banco privado, atomicidade/idempotência interna do SIAC ou rotação
de sua credencial. Segurança e contraste têm verificações específicas; não são
certificação completa. Infraestrutura autorizada continua necessária para publicar.

## Execuções intermediárias e limpeza

Não foram contadas como aprovação: seletores ambíguos após adicionar senhas,
alerta local mantido depois do retry, sessão expirada sem mensagem, corridas nos
testes de duas abas e erro do roteamento do navegador ao encerrar requisições.
Helper espera encerramento dos handlers e usa fallback no bloqueio de rede local.
Uma regressão Node 24 revelou paginação antiga após filtro; início síncrono do
loading impede usar a página anterior. Reexecuções finais devem passar integralmente.

Removidos diagnóstico executável obsoleto, organização por dias, preparação de
entrevista, rascunho de e-mail e saídas/capturas intermediárias redundantes.
README/ARQUITETURA/RELATORIO consolidam causas e decisões; IMPLANTACAO.md fica
na raiz. O diretório de documentação auxiliar foi completamente removido;
capturas opcionais não o recriam. deploy/, migrações, scripts de
execução/backup/smoke/segredos, testes, lockfiles e enunciado original permanecem.
Tudo removido continua recuperável pelo histórico Git; nenhuma autoria foi alterada.

## Exclusão final da documentação auxiliar

Os 17 artefatos restantes foram removidos após inventário: 11 PNG e seis TXT.
Resumo técnico preservado neste documento e no RELATORIO. Nenhum teste removido;
os 20 testes Chromium de auditoria e múltiplos carrinhos foram executados com
capturas ativadas, todos aprovados. As oito imagens foram gravadas em
/tmp/kaizen-capturas-remocao, sem recriar o diretório excluído. Scanner de
segredos, links locais (zero quebrados) e git diff --check aprovados.

## Histórico da regressão — preparação inicial Netlify/ngrok

O registro desta seção pertence à revisão anterior por plugin. A configuração e
as pendências de infraestrutura descritas nela foram substituídas pela revisão abaixo.

Node 20.19.2: **140 backend + 69 frontend = 209 aprovados**, zero falhas,
cancelamentos ou skips. Preservados os 203 testes anteriores e adicionados seis:
um de cache privado na API e cinco de configuração/proxy/validação de URL.
Frontend inclui 58 cenários Chromium e 11 unitários. Build Vite aprovado,
63 módulos. Smoke de produção ampliado aprovado; scanner de segredos,
auditorias backend/frontend (zero vulnerabilidades) e links locais aprovados.

Node 24.21.0: repetidas ambas as suítes completas em cópia isolada, novamente
**140 + 69 = 209 aprovados**, zero falhas/cancelamentos/skips. Build e smoke
ampliado também aprovados. Dependências nativas do runtime 24 foram usadas
separadamente, com os dois lockfiles idênticos aos do workspace.

CLI Netlify 27.12.0 com @netlify/build 37.4.1/Node 24.21.0: configuração
resolvida com base frontend e publish frontend/dist, hook carregado, proxy
inserido antes do fallback e build aprovado em modo offline usando fixture.
Sem NGROK_URL, o build falhou intencionalmente com a mensagem de configuração.
A fixture não é um domínio real de entrega; não foi publicada.

Diagnóstico real somente local/read-only, production como henrique em porta
3002 temporária: /api/health 200/erp ok, /api/catalogo?tamanho=1 200,
/api/catalogo/categorias 200; JSON válido e no-store. Processo encerrado por
SIGTERM após a leitura. Banco novo persistente íntegro, sem tocar no banco antigo.

**Não executados:** túnel HTTPS ativo e proxy Netlify real; cookies de sessão,
GET/POST/PATCH/PUT/DELETE, F5, navegação/mobile/Console/Network pela origem pública.
Dependem de autenticação ngrok, porta 3001 livre, autorização SIAC e site Netlify.
Não foram contabilizados como aprovados. Terminal gráfico aberto apenas para
autenticação. Nenhum pedido real foi criado.

## Upload manual Netlify — revisão atual

Node 20.19.2: **140 backend + 76 frontend = 216 aprovados**, zero falhas,
cancelamentos/skips. Frontend: 62 cenários Chromium e 14 unitários. O baseline
de 209 não foi reduzido: testes de configuração adaptados à remoção do plugin,
mais três de respostas HTTP/JSON e quatro de imagens. Build Vite (64 módulos),
smoke production, scanner, auditorias (zero vulnerabilidades), sintaxe e diff check
aprovados. npm ci e builds repetidos realizados; dist contém index/assets/regras/headers.

Node 24.21.0: ambas as suítes completas repetidas em cópia isolada, novamente
**140 + 76 = 216 aprovados**, sem falhas/cancelamentos/skips. Build de 64 módulos
e smoke de produção também aprovados, com dependências nativas do runtime correto.
Verificação do dist real: cinco arquivos, nenhum segredo conhecido/.env/banco/mapa;
headers e redirects idênticos a public e assets referenciados pelo index existentes.

HTTP real: local/ngrok health JSON/200, production/erp ok, catálogo JSON/200;
Netlify antigo health/catalogo HTML/404. Aviso ngrok HTML/200 reproduzido com
User-Agent de navegador sem header; bypass devolve JSON/SVG. Origem antiga no
backend rejeitava a URL atual com 403. Corrigida somente linha CORS privada;
reinício Node anunciado, com zero checkouts ativos; ngrok conservado no mesmo PID.
Health com Origin atual 200 e preflight 204 com credenciais/origem exata.

CLI oficial Netlify, dist sem plugins: health/catalogo/categorias JSON/200,
erros 401/404 JSON sem fallback HTML ou Location, SPA/headers/assets 200.
Chromium via CLI/ngrok real: imagens com header/data URL, sem erro JavaScript,
360/390/768/1440 px sem overflow e refresh de entrar/cadastro/perfil/carrinho.
Não foram realizadas escritas de teste no banco privado.

Smoke CLI adicional em produção mock aprovou GET/POST/PATCH/PUT/DELETE,
query/JSON, X-Carrinho-Id, Set-Cookie Secure/HttpOnly/Lax/host-only, Cookie,
sessão, endereços, quantidades, isolamento e erros 401/404/409/502/recuperação.
SQLite temporário, cópia de dist em /tmp e ERP mock; zero pedidos.

Execuções intermediárias não contadas como aprovação: seletor que pressupunha
primeiro produto Filtro, espera de imagens lazy fora da tela, expectativas 200/409
incorretas no smoke novo e CLI inicialmente interrompida por ENOSPC. Cache próprio
da CLI movido para /tmp sem apagar dados do usuário; disco ainda precisa de manutenção.

**Pendente após upload:** testes pelo domínio Netlify definitivo com o novo build,
login/logout, cookies HTTPS/F5, cadastro/endereço/carrinhos e mobile/Network/Console.
Os testes locais/CLI não foram apresentados como aprovação no CDN público.
