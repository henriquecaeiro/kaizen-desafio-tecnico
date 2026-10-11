# Validação dos Dias 2 e 3

Registro histórico preservado. A auditoria e regressão posteriores estão em
[VALIDACAO-FINAL.md](VALIDACAO-FINAL.md); os números abaixo não representam a suíte atual.

## Dia 2

Workspace Linux: `/home/henrique/DEV/kaizen-desafio-tecnico`, Node 20.19.2,
Chromium do sistema. Instalações por `npm ci`; better-sqlite3 compilado localmente.
O ambiente difere do Windows registrado no Dia 1. Nenhum banco existente foi resetado.

| Etapa | Comando / resultado |
|---|---|
| KZN-312 | backend `npm test`: 15/15; frontend `npm run build`: aprovado |
| KZN-318 | backend `npm test`: 16/16; frontend `npm test`: 4/4; build aprovado |
| KZN-325 | frontend `node --test tests/catalogo.test.mjs`: 5/5; build aprovado |
| KZN-331 | backend `npm test`: 23/23; frontend suíte: 11/11, mais teste novo de endereço criado: arquivo checkout 3/3; build aprovado |

Testes afirmam o comportamento corrigido. O script do Dia 1 não foi executado
como regressão. ERP mock HTTP e SQLite temporário; fetch dos testes limitado a
loopback. Navegador abre o código modificado pelo Vite, com proxy para esse backend.
Reproduções esperadas de falhas (503/409/422) aparecem nos logs de teste.

Falhas durante desenvolvimento: primeira execução antecipou a compilação nativa;
seletor ambíguo de CEP no teste e espera imediata do checkbox foram corrigidos.
Essas execuções não foram contadas como validação aprovada.

As branches são publicadas no repositório de Henrique. HTTPS sem credencial
falhou; push passou usando a chave SSH já existente, sem exibir credenciais.

Regressão final na main do Dia 2: backend 23/23, frontend 12/12, build aprovado.

## Dia 3

| Verificação | Comando | Resultado |
|---|---|---|
| Backend | cd backend; npm test | 51 testes, 51 aprovados, 0 falhas, 0 skips |
| Interface | cd frontend; npm test | 25 testes, 25 aprovados, 0 falhas, 0 skips |
| Build | cd frontend; npm run build | Vite aprovado, 62 módulos |
| Bootstrap production | cd backend; node scripts/smoke-producao.mjs | HTML/assets, fallback SPA, health com ERP mock, autenticação e 404 aprovados |
| Revisão | git diff --check; node backend/scripts/verificar-segredos.mjs | Sem erros de whitespace ou segredos/banco nos arquivos versionados |

Total da suíte final: **76 testes, 76 aprovados, 0 falhas**. Saídas completas:
[backend](evidencias/dia3-backend.txt), [frontend](evidencias/dia3-frontend.txt),
[build](evidencias/dia3-build.txt). Comandos podem ser repetidos conforme README.

Backend inclui migrações v0→v2 e v1→v2, preservação de contas/endereços/vínculos/
itens, rollback, repetição, cascade, carrinhos/limites/ativação, dois usuários com
IDs alheios na API, preço novo do ERP e erros. Concorrência: duas conexões SQLite,
dois POSTs HTTP, mutação iniciada antes da reserva, bloqueio durante envio,
troca de ativo, replay de UUID, recusa, timeout após aceite e falha local por
trigger. O índice e as transações protegem processos que usam o mesmo arquivo.

Frontend inclui seleção, criação/renomeação/exclusão/limpeza, itens e contador,
estoque parcial, checkout com endereço escolhido e preservação dos demais,
resultado incerto, erros/loading, sessão/refresh e respostas fora de ordem. Busca,
filtros, paginação e histórico permanecem na URL. Consulta inicial de autenticação
atrasada também não pode desfazer um login mais recente. Navegador realmente executa
o frontend modificado, usando Vite/proxy para backend e SIAC temporários.

360, 390, 768 e 1440 px: sem overflow horizontal, painel dentro da viewport,
Tab mantém foco no dialog, Escape/fechamento devolve foco ao acionador. Capturas
fictícias: [360](evidencias/dia3-carrinho-360.png),
[390](evidencias/dia3-carrinho-390.png), [tablet](evidencias/dia3-carrinho-768.png),
[desktop](evidencias/dia3-carrinho-1440.png). Imagens inspecionadas visualmente.

Falhas encontradas e resolvidas durante implementação: ciclo de foco do drawer;
seletores de testes que encontravam o produto no painel e catálogo ou procuravam
texto isolado dentro do alerta com botão. Uma execução foi interrompida após
formatação disparar HMR no meio do login; não foi tratada como aprovação.

Não verificado: implantação pública/HTTPS real, carga, Safari/Firefox, banco real
com dados de clientes, rotação externa, atomicidade interna do estoque ou chave
idempotente do SIAC. Nenhum pedido real enviado. O smoke de production usa
bootstrap real, mas ambiente temporário com ERP mock e não equivale a hospedagem.
