# Validação da entrega — 12/10/2026

Resultados se referem ao código executado, com SQLite descartável e ERP HTTP em
loopback. Os testes bloqueiam acesso externo. Nenhum pedido real foi enviado.

## Resultado e ambiente

Baseline histórico: 131 backend + 39 frontend = 170 aprovados. Saídas preservadas:
[backend](docs/evidencias/final-backend-workspace.txt) e
[frontend](docs/evidencias/final-frontend-workspace.txt). As validações anteriores
de 76 e 165 casos estão consolidadas no RELATORIO e no histórico Git.

A regressão consolidada aprovou **139 backend + 64 frontend = 203 testes** em
Node 24.21.0, com **203 aprovados, zero falhas, cancelamentos e skips**. Isso
representa 33 casos adicionais ao baseline. Frontend inclui seis unitários de
máscaras e 58 cenários executados em Chromium. A suíte também foi validada no
Node 20 do workspace antes dos dois últimos casos de catálogo/chamados (139+62).

Node 24.21.0 corresponde à .nvmrc. Runtime obtido da distribuição oficial com
SHA-256 conferido, npm ci dos dois lockfiles em cópia isolada, sem alterar o
Node/dependências do usuário. Os 103 arquivos de código/testes/configuração da
cópia foram comparados byte a byte com o workspace, sem divergências.

| Verificação final | Resultado |
|---|---|
| Backend completo | 139/139, Node 24.21.0 |
| Frontend completo | 64/64, Chromium com aplicação real e ERP mock |
| Build | Aprovado, Vite 7.3.7, 63 módulos |
| Smoke production | Aprovado; inclui persistência após reinício, zero pedidos |
| Auditorias npm | Zero vulnerabilidades conhecidas, backend e frontend |
| Scanner de segredos | Nenhum segredo/banco identificado; arquivos e histórico |
| Sintaxe e whitespace | node --check e git diff --check aprovados |
| Documentação | Links locais válidos e enunciado original preservado |
| Serviço | systemd-analyze verify aprovado; Caddyfile preservado, sem nova validação do Caddy nesta revisão |

Saídas completas: [backend](docs/evidencias/manual-backend-node24.txt),
[frontend](docs/evidencias/manual-frontend-node24.txt),
[build](docs/evidencias/manual-build-node24.txt) e
[smoke](docs/evidencias/manual-smoke-node24.txt).

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

Capturas fictícias de painel e produto nas quatro larguras permanecem em
docs/evidencias/. As três capturas da reprodução original dos chamados foram
preservadas; as imagens não representam pedidos reais.

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
Não cria pedidos. Capturas opcionais: CAPTURAR_EVIDENCIAS=true npm test no frontend.

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
na raiz. docs/ contém somente evidências úteis. deploy/, migrações, scripts de
execução/backup/smoke/segredos, testes, lockfiles e enunciado original permanecem.
Tudo removido continua recuperável pelo histórico Git; nenhuma autoria foi alterada.
