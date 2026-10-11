# Validação final — 11/10/2026

## Ambiente e resultado

Workspace: /home/henrique/DEV/kaizen-desafio-tecnico. A main inicial e origin/main
coincidiam em e7052de; branches dos Dias 2/3 já integradas. Alteração não versionada
preexistente package-lock.json na raiz foi preservada e não incluída na entrega.
O workspace Windows citado não estava montado neste ambiente.

Baseline reexecutado: **51 backend + 25 frontend = 76 aprovados**.
Suíte atual: **130 backend + 35 frontend = 165 testes**, **165 aprovados, zero
falhas/cancelamentos/skips na execução final aprovada**. Aumento de 89 casos
em relação ao registro histórico, não soma de execuções repetidas.

Node 20.19.2 do workspace e Node **24.21.0 de .nvmrc**, com instalação limpa
dos lockfiles em cópia isolada do código funcional até 5da38de. Node 24 foi obtido
da distribuição oficial, com SHA-256 conferido; não substituiu Node/dependências
do workspace. better-sqlite3 foi instalado para esse runtime. Navegador:
Chromium /usr/bin/chromium via playwright-core. Nenhum navegador adicional baixado.

| Verificação | Comando (diretório) | Resultado |
|---|---|---|
| Backend completo | npm test (backend) | 130/130, Node 20 e 24 |
| Navegador completo | npm test (frontend) | 35/35, Node 20 e 24 |
| Evidências do painel | CAPTURAR_EVIDENCIAS=true npm test (frontend) | Capturas em quatro larguras |
| Build | npm run build (frontend) | Vite, 62 módulos, aprovado |
| Produção real local | node scripts/smoke-producao.mjs (backend) | Bootstrap production + reinício aprovados |
| Segredos | node scripts/verificar-segredos.mjs (backend) | Arquivos/blobs históricos, sem achados nos critérios usados |
| Dependências backend | npm audit --omit=dev --json (backend) | 0 vulnerabilidades conhecidas reportadas |
| Dependências frontend | npm audit --json (frontend) | 0 vulnerabilidades conhecidas reportadas |
| Whitespace | git diff --check; git diff main...HEAD --check | Sem erros |
| Sintaxe | node --check em cada .js/.mjs do backend | Sem erros; JSX validado pelo build |
| Serviço | systemd-analyze verify deploy/kaizen.service | Exit 0 |
| Proxy | caddy validate --config deploy/Caddyfile --adapter caddyfile | Valid configuration, Caddy 2.11.7 |

Caddy obtido da release oficial com digest SHA-256 conferido, usado somente
para validar configuração. Não foi iniciado servidor público nem emitido
certificado para a solução. Diretórios temporários de ferramentas não integram Git.

Saídas preservadas: [backend Node 24](evidencias/final-backend-node24.txt),
[frontend Node 24](evidencias/final-frontend-node24.txt),
[build Node 24](evidencias/final-build-node24.txt),
[produção local](evidencias/final-smoke.txt),
[backend workspace](evidencias/final-backend-workspace.txt),
[frontend workspace](evidencias/final-frontend-workspace.txt).
Comandos são repetíveis no README; arquivos não contêm credenciais reais.

Na retomada da finalização em 11/10/2026, o ajuste de captura opcional de produto
foi validado com `node --test --test-concurrency=1 tests/auditoria.test.mjs`
no frontend: **10/10 aprovados**, sem falhas/skips. Sem
`CAPTURAR_EVIDENCIAS=true`, a execução preservou as capturas existentes.
Essa reexecução é parte dos 35 testes de frontend, não amplia o total de 165.

## Cobertura do comportamento

- Totais/centavos/elegibilidade, linhas/unidades, estoque/inativo/ausente, ERP
  indisponível e quatro chamados. Busca/filtros/URL/histórico/paginação mantidos.
- Migrações banco novo/v0/v1, repetição, rollback, cascade e principal legado
  ausente/duplicado. Endereços válidos, usuários/itens/vínculos preservados.
- Carrinhos padrão, limite dez, seleção persistida, gestão/itens e IDs alheios
  em serviços/API. Dois usuários; consultas parametrizadas/propriedade no backend.
- CORS autorizado/arbitrário/null/sem Origin e preflight; cookies production;
  replay após logout/senha, expiração, assinatura, JWT antigo sem jti, concorrência
  de senha/login e resposta antiga que não pode apagar cookie recente.
- Rate limit por conta/IP, cadastro/payload inválido, janela expirada,
  persistência, concorrência e tentativa de evasão por X-Forwarded-For.
- Senhas com espaços, caracteres Unicode e normalização NFKC existente; telefone
  preenchido/substituído/omitido/vazio/null; principal em criação/edição/exclusão,
  desmarcação do único, índice/rollback e endereço alheio.
- JSON malformado/vazio/null/array/tipos/campos ausentes em catálogo, produto,
  categorias e pedido; respostas válidas, timeout, 5xx/401; health/corpo de imagem.
  Histórico mantém dados locais e status indisponível explícito; retry recupera.
  Detalhes de produto/pedido não confundem indisponibilidade com 404.
- Stream interrompido encerra conexão sem derrubar backend; logs não contêm
  marcadores de query/cookie/header arbitrário/corpo remoto usados no teste.
- Checkout ativo e preservação de outros, endereço/snapshot/observação, estoque
  insuficiente, recusa/falha local/timeout após aceite, UUID repetido, mutações
  durante envio, duas conexões/POSTs HTTP e dois usuários simultâneos.
- Encerramento abrupto de processo em VALIDANDO/ENVIANDO e nova execução mantêm
  reserva/itens sem reenvio. Incerteza não é liberada automaticamente.
- Backup online com WAL, arquivo 0600, recusa de sobrescrita/origem inválida,
  verificações de integridade e restauração em arquivo novo.

## Navegador e inspeção visual

Automatizado em **360, 390, 768 e 1440 px**: catálogo, produto disponível/sem
estoque, carrinho, checkout, perfil/endereços, pedidos/detalhe, login/cadastro.
Sem overflow horizontal, controles visíveis com nomes/labels e botões >=24 px.
Contraste de textos calculado no render, via canvas sRGB, com fundos/opacidade e
extremos do gradiente; zero falhas na verificação após corrigir opacidade do
e-mail. Não inclui todas as possibilidades de gradiente/placeholder/leitor de tela.
Drawer verifica Tab/Shift+Tab/Escape/retorno de foco. Skip link recebe teclado e
foca main. Erros vinculam aria-invalid/aria-describedby; loaders têm role=status.

Capturas fictícias atuais: painel
[360](evidencias/final-carrinho-360.png), [390](evidencias/final-carrinho-390.png),
[768](evidencias/final-carrinho-768.png), [1440](evidencias/final-carrinho-1440.png);
produto [360](evidencias/final-produto-360.png),
[390](evidencias/final-produto-390.png), [768](evidencias/final-produto-768.png),
[1440](evidencias/final-produto-1440.png). Inspecionadas visualmente por imagem.
Não houve teste manual humano em aparelho físico ou certificação WCAG completa.
Evidências dos Dias 1/3 foram mantidas, sem sobrescrever com capturas atuais.

## Smoke de produção

Executa src/server.js de verdade, production, dist atualizado e SQLite temporário
com ERP HTTP mock. Verifica HTML/assets, refresh SPA, health/catálogo, CSP/nosniff,
404 API (incluindo /api), rotas protegidas, login/logout, atributos Secure/HttpOnly/
Lax, CORS, gestão/itens e persistência de carrinho/seleção/sessão após reinício.
**Zero pedidos enviados**. Cookie é inspecionado por HTTP em loopback; isso não
equivale a testar TLS/cookie pelo domínio público.

## Falhas durante desenvolvimento — não tratadas como aprovação

Seletores iniciais procuravam textos diferentes dos reais; uma execução foi
interrompida para corrigi-los. A auditoria depois encontrou botões pequenos,
observação sem nome acessível e contraste da ajuda do perfil: código corrigido,
sem relaxar expectativa. Restauração esperava dois carrinhos, mas B ainda não
havia acessado; fixture passou a exercitar esse acesso antes do backup.

Regressão com muitos arquivos/processos paralelos e navegador teve 1 timeout do
mock de 250ms (124/125), sem aprovação. Arquivos backend passaram a rodar em
sequência, como frontend; testes internos de requisições/conexões/processos
concorrentes permanecem. Execuções completas posteriores passaram. Não foi
executado diagnostico-dia1.mjs para certificar regressão.

## Limites e bloqueios externos

Health público do SIAC foi consultado somente por GET e retornou 200/status ok.
Nesta etapa não há credencial de produção fornecida, então catálogo autenticado
real não foi reconfirmado. **Nenhum pedido real criado.** Mocks não demonstram
atomicidade interna do estoque ou idempotência do SIAC.

Sem host/domínio/acesso autorizado: implantação pública, TLS real e verificação
no destino continuam pendentes. Credencial histórica exige rotação pelo
responsável. Conferência operacional de tentativas incertas/interrompidas deve
ser acordada. Safari/Firefox, dispositivos reais, carga, leitor de tela e
restauração de banco real não foram verificados. Segurança/contraste são
verificações específicas, não promessa de ausência de todo risco.
