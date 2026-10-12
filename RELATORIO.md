# Relatório de entrega

**Candidato:** Henrique Caeiro
**Data de entrega:** em preparação; código revisado em 12/10/2026. Envio e implantação pública pendentes.
**Tempo aproximado dedicado:** não cronometrado.

Chamados, múltiplos carrinhos e ajustes manuais implementados/testados. Causas e reproduções históricas estão consolidadas neste relatório. Resultados atuais em [VALIDACAO-FINAL.md](VALIDACAO-FINAL.md). **Entrega parcial somente pela implantação pública:** faltam host/acesso/domínio e credencial de produção autorizados; não há URL pública da solução.

---

## 1. Subindo o projeto

Desenvolvimento e revisão em Linux/Node 20.19.2, com Chromium instalado. Também validei Node 24.21.0 de .nvmrc em cópia isolada, com dependências instaladas pelos lockfiles. Execução no README; segredos somente no ambiente.

npm run db:init ou bootstrap aplica migrações 001–005, sem db:reset. Fixtures usam SQLite temporário; nenhum banco real foi resetado ou publicado. Em produção, Express serve frontend/dist na mesma origem e recusa iniciar sem build. Serviço systemd/Caddy, variáveis privadas, backup online/restauração e atualização estão em [IMPLANTACAO.md](IMPLANTACAO.md). Configurações e produção local foram validadas; host público não foi disponibilizado. Não criei cobrança nem usei infraestrutura pessoal/corporativa.

O código foi publicado no repositório de Henrique. Não há aplicação pública implantada: falta infraestrutura autorizada com disco persistente, domínio e credencial SIAC. Os arquivos novos de serviço, proxy e backup estão em deploy/ e backend/scripts/; não substituem a validação no host real.

---

## 2. Chamados reportados

### KZN-312 — Total do carrinho vem maior que a soma das peças

| | |
|---|---|
| **Causa** | O serviço somava subtotais de todas as linhas, inclusive pendentes. Math.floor na conversão monetária perdia centavos (1.15 → 114). |
| **Como reproduzi** | Reprodução na base: radiador sem estoque 684 + disponíveis 110 → total 794. |
| **Correção** | valor_total soma somente linhas disponíveis; valor_itens mantém soma das linhas conhecidas. Linha mantém valor_total e recebe valor_elegivel. Sem remoção/redução automática. Checkout exige resolver todas as pendências. |
| **Arquivos alterados** | carrinhoService.js, dinheiro.js, Carrinho.jsx/ItensCarrinho.jsx; backend/tests/carrinho.test.mjs e dinheiro.test.mjs. |
| **Como validei a correção** | Vazio, disponíveis, zero/parcial/inativo/404, falha ERP, quantidades e centavos; pendência bloqueia pedido. Conversão arredonda meio centavo para cima, somas usam preço em centavos × quantidade, sem reconverter subtotais. |

Falha de consulta é erro, não carrinho vazio; somente produto ausente vira pendência. Um item sem preço conhecido tem valor zero informado, sem permitir compra.

### KZN-318 — Número no ícone do carrinho está errado

| | |
|---|---|
| **Causa** | quantidade_pecas usava itens.length; contexto também ignorava mudanças da sessão. |
| **Como reproduzi** | Reprodução na base: FIL=3 e SUS=4 → duas peças; logout/login B manteve estado visual de A. |
| **Correção** | Serviço soma unidades, inclusive pendentes; quantidade_itens continua contando produtos distintos. Contexto limpa/recarrega por identidade e aceita somente requisição atual da mesma sessão. AuthContext descarta consulta inicial da sessão quando um login/cadastro/logout mais recente já terminou. |
| **Arquivos alterados** | carrinhoService.js, CarrinhoContext.jsx e consumidores; testes de carrinho/sessão. |
| **Como validei a correção** | 3+4=7, inclusão repetida, alteração, remoção/limpeza, login/logout/troca, resposta antiga de sessão e leitura anterior a mutação. Erro de leitura tem estado e opção de repetir. |

Cabeçalho consome o contador do backend, sem cálculo duplicado. A auditoria final acrescentou revogação de sessões persistidas, além da consistência visual.

### KZN-325 — Busca diz que não encontrou peça que existe

| | |
|---|---|
| **Causa** | Busca/filtros preservavam pagina anterior. Próxima comparava pagina com total_paginas - 1. Campo não acompanhava URL. |
| **Como reproduzi** | Reprodução na base: /?pagina=2&busca=amortecedor tinha lista vazia, apesar de resultados na página 1. |
| **Correção** | Mudar critérios remove pagina, preservando demais filtros; paginar conserva critérios. Campo acompanha termo da URL. Próxima desabilita na última página. |
| **Arquivos alterados** | Cabecalho.jsx, Catalogo.jsx, ui.jsx; frontend/tests/catalogo.test.mjs. |
| **Como validei a correção** | Busca inicial/depois de paginar, categoria/disponibilidade/limpeza, combinações, URL, back/forward/refresh, 1/2/3 páginas, Pedidos até terceira página e resposta atrasada. |

O catálogo já descartava respostas de efeitos encerrados. Esse comportamento foi preservado e testado; não acrescentei ciclos de atualização.

### KZN-331 — Pedido saiu com o endereço errado

| | |
|---|---|
| **Causa** | Radio alterava enderecoId, mas finalizar buscava novamente o principal. |
| **Como reproduzi** | Reprodução na base com mock: Oficina selecionada; payload/snapshot recebiam Casa. Contraprova backend já respeitava ID. |
| **Correção** | Frontend envia enderecoId; principal só define seleção inicial. |
| **Arquivos alterados** | Checkout.jsx; testes backend/frontend de checkout. |
| **Como validei a correção** | Único, principal/secundário, recém-criado, excluído em outra aba, alheio, snapshot/observação, edição posterior e falha de estoque. |

Backend não precisou mudar para corrigir endereço: autenticação, propriedade e snapshot foram preservados. As alterações posteriores tratam múltiplos carrinhos e concorrência.

---

## 3. Problemas que encontrei por conta própria

Achados históricos identificados por A01–A22, consolidados abaixo. Os grupos abaixo registram causa, evidência, impacto e tratamento, incluindo os achados da última revisão.

### Problema 1 — Credenciais e verificação de arquivos (A01)

| | |
|---|---|
| **O que está errado** | A base continha credencial SIAC e fallback de segredo. O scanner posterior examinava somente arquivos rastreados, deixando passar um segredo em arquivo novo. |
| **Como cheguei nele** | Inspeção inicial de configuração; na revisão, uma fixture com config.js não rastreado fez o scanner retornar sucesso. |
| **Impacto** | Acesso indevido ao ERP e publicação acidental de segredos ou bancos. |
| **Corrigi?** | Removidos valores/fallbacks; scanner cobre rastreados, novos não ignorados, backups parciais e histórico, sem imprimir valores. Rotação da credencial histórica depende do responsável pelo SIAC. |
| **Arquivos alterados** | backend/src/config.js, backend/.env.example, .gitignore, backend/scripts/verificar-segredos.mjs e backend/tests/segredos.test.mjs. |

### Problema 2 — Sessões e consistência de senha (A12/A13)

| | |
|---|---|
| **O que está errado** | Login removia espaços aceitos no cadastro; cookie antigo continuava válido após logout/troca de senha. |
| **Como cheguei nele** | Login com a mesma senha cadastrada e replay HTTP do cookie; testes de login/troca concorrentes. |
| **Impacto** | Senha correta rejeitada e sessão comprometida permanecendo utilizável. |
| **Corrigi?** | Senhas preservam espaços/NFKC; jti exige sessão vigente no SQLite. Logout revoga uma sessão; senha revoga as anteriores. Revalidação de hash protege login/trocas concorrentes. 401 antigo não limpa cookie novo. |
| **Arquivos alterados** | backend/src/lib/validacao.js, middleware/autenticacao.js, routes/auth.js, routes/perfil.js, services/sessaoService.js, services/usuarioService.js e db/migrations/003-sessions.sql. Caminhos relativos a backend/src. |

### Problema 3 — Estado visual de sessão e carrinho (A03/A20)

| | |
|---|---|
| **O que está errado** | Estado de A podia permanecer em B; respostas antigas sobrescreviam dados atuais. Na última revisão, salvar perfil atrasado restaurou A após login de B, inclusões fora de ordem deixaram o badge em 1 com 2 peças, e logout com falha ocultou uma sessão ainda válida. |
| **Como cheguei nele** | Navegador com duas contas e respostas retidas/liberadas em ordem controlada; logout HTTP 503 simulado. Os quatro novos casos de interface falharam antes das correções. |
| **Impacto** | Identidade e quantidade exibidas incorretamente, sem mudar a autorização do backend; falsa indicação de logout. |
| **Corrigi?** | Contextos descartam leituras antigas por identidade/requisição. Atualização de perfil exige a conta atual; mutação antiga que terminou depois provoca nova leitura. Logout só limpa estado após confirmação e exibe falha para repetir. |
| **Arquivos alterados** | frontend/src/contextos/AuthContext.jsx, CarrinhoContext.jsx, componentes/Cabecalho.jsx, paginas/Perfil.jsx e frontend/tests/integridade-interface.test.mjs. Os caminhos abreviados são relativos a frontend/src. |

### Problema 4 — Checkout concorrente e resultado incerto (A04/A05/A06)

| | |
|---|---|
| **O que está errado** | Dois fechamentos criavam pedidos duplicados; itens adicionados durante HTTP podiam ser apagados. Timeout após aceite remoto permitia reenviar. |
| **Como cheguei nele** | POSTs/duas conexões concorrentes, timeout após aceite, trigger de falha local e queda real do processo em VALIDANDO/ENVIANDO. |
| **Impacto** | Duplicação de compra e perda de itens ou vínculo com pedido aceito. |
| **Corrigi?** | Reserva persistida por carrinho, bloqueio de mutações e conclusão local transacional. Incerto/interrompido mantém itens e bloqueio. Idempotência/atomicidade do SIAC não foram demonstradas; conferência externa continua obrigatória. |
| **Arquivos alterados** | backend/src/services/pedidoService.js, checkoutTentativaService.js, carrinhoService.js, carrinhosService.js e backend/src/db/migrations/002-checkout-attempts.sql. |

### Problema 5 — Origens, proxy e limite de autenticação (A07/A19)

| | |
|---|---|
| **O que está errado** | CORS refletia qualquer origem com credenciais; proxy era sempre confiável e autenticação não tinha limite. |
| **Como cheguei nele** | Requisições de origens arbitrárias e tentativas por conta/IP com X-Forwarded-For variável e reinício. |
| **Impacto** | Exposição a origens indevidas, evasão por headers e tentativas ilimitadas de senha. |
| **Corrigi?** | Origens exatas, HTTPS em produção e proxies explícitos. Limites persistidos por IP/conta, com Retry-After; não substituem proteção de borda e podem afetar NAT ou conta alvo. |
| **Arquivos alterados** | backend/src/app.js, config.js, middleware/limiteAutenticacao.js, routes/auth.js, routes/perfil.js e db/migrations/004-auth-limits.sql. Caminhos relativos a backend/src. |

### Problema 6 — Perfil e endereço principal (A10/A11)

| | |
|---|---|
| **O que está errado** | Limpar telefone conservava o antigo; desmarcar o principal podia deixar a conta sem padrão. |
| **Como cheguei nele** | PATCH vazio/null/omitido; criação/edição/exclusão e migração de endereços sem principal ou com dois. |
| **Impacto** | Perfil não refletia a edição e checkout perdia seleção inicial previsível. |
| **Corrigi?** | Telefone distingue omitido de limpeza; principal é mantido/promovido em transação. Migração repara flags preservando conteúdo/datas; índice garante no máximo um. |
| **Arquivos alterados** | backend/src/routes/perfil.js, routes/enderecos.js, services/usuarioService.js, services/enderecoService.js e db/migrations/005-primary-address.sql. |

### Problema 7 — Entrada e limites numéricos (A02/A14/A15)

| | |
|---|---|
| **O que está errado** | Quantidade aceitava booleano/array e soma saturava silenciosamente em 99. Páginas enormes produziam números inseguros para ERP/offset SQL. Arredondamento monetário está descrito no KZN-312. |
| **Como cheguei nele** | Payloads true/[2], soma 98+5 e paginação acima de Number.MAX_SAFE_INTEGER ou convertida em Infinity. |
| **Impacto** | Quantidade diferente da solicitada, perda de centavos e erro de integração/consulta por entrada inválida. |
| **Corrigi?** | Tipos/inteiros seguros validados; excesso dá conflito sem alterar itens. Paginação fora do intervalo seguro normaliza para 1 antes de consultar ERP/SQLite. |
| **Arquivos alterados** | backend/src/lib/validacao.js, dinheiro.js, services/carrinhoService.js e backend/tests/erp.test.mjs. |

### Problema 8 — Contratos ERP, recuperação e logs (A16/A21/A22)

| | |
|---|---|
| **O que está errado** | JSON inválido parecia catálogo vazio; erros de pedidos persistiam, streams não tratavam interrupção e acesso registrava query. Na revisão, catálogo ainda mostrava vazio/resultados antigos junto de 502. |
| **Como cheguei nele** | Mock com corpos/tipos inválidos, timeout/5xx/401, stream interrompido, marcadores sensíveis em logs e falha/retry no catálogo renderizado. |
| **Impacto** | Falha externa confundida com ausência de peças/pedidos e possível exposição em logs. |
| **Corrigi?** | Contratos nos campos consumidos, 502 explícito, histórico local com status indisponível, retry nas telas, pipeline e logs sem query/cookie/corpo remoto. Catálogo com erro oculta resultados e permite repetir mantendo filtros. |
| **Arquivos alterados** | backend/src/erp/cliente.js, contratos.js, routes/imagens.js, middleware/requisicao.js, middleware/erros.js, services/pedidoService.js; frontend/src/paginas/Catalogo.jsx, Pedidos.jsx, PedidoDetalhe.jsx e Produto.jsx. |

### Problema 9 — Navegação, estoque parcial e layout (A08/A09/A17/A18)

| | |
|---|---|
| **O que está errado** | Próxima parava cedo, busca não acompanhava URL, quantidade indisponível bloqueava redução e layout rígido prejudicava mobile. |
| **Como cheguei nele** | Navegação/histórico, estoque 2 com quantidade 4, render em 360/390/768/1440 px e verificações de foco/contraste/labels. |
| **Impacto** | Peças inacessíveis na última página e dificuldade para corrigir orçamento ou usar celular/teclado. |
| **Corrigi?** | Paginação/campo sincronizados, redução permitida com validação no servidor, grid/painel responsivos, labels e foco. Não houve certificação WCAG completa. |
| **Arquivos alterados** | frontend/src/componentes/Cabecalho.jsx, ui.jsx, ItensCarrinho.jsx, PainelCarrinho.jsx, frontend/src/paginas/Catalogo.jsx, Checkout.jsx, Perfil.jsx e Produto.jsx. |

---

## 4. Múltiplos carrinhos

### Como ficou

Gerenciamento na página de carrinho e na vitrine: criar, renomear, selecionar/excluir, incluir/alterar/remover/esvaziar itens, disponibilidade, total e checkout. Criar pela interface também ativa o novo carrinho; POST da API apenas cria, permitindo ao cliente escolher quando ativar.

Desktop tem painel lateral sem bloquear o catálogo; mobile/tablet usa dialog sobreposto. Nenhuma ação de gerenciamento altera busca, filtros, paginação ou histórico. Componentes são compartilhados com a página de carrinho, usando tokens existentes. Drawer permite Tab/Shift+Tab, Escape e retorno do foco; exclusão/limpeza exigem confirmação.

### Modelagem

carrinhos: id, usuario_id (cascade), nome (1–80), ativo e datas. Índice único parcial garante no máximo um ativo por usuário. carrinho_itens: FK carrinho_id com cascade e UNIQUE(carrinho_id,codigo_produto); somente código, quantidade e data. Preço/estoque continuam no SIAC.

schema.sql é base v0. Migração 001 cria um padrão para cada usuário existente e transfere itens preservando ids, códigos, quantidades e datas. Contagem verifica perda de linhas; foreign_key_check verifica relações. Migração 002 cria checkout_tentativas. user_version evita execução repetida; todas as migrações pendentes rodam numa transação IMMEDIATE com rollback. Usuários, endereços e vínculos de pedidos são preservados. Banco novo e banco anterior são suportados.

| Método | Rota | O que faz |
|---|---|---|
| GET | /api/carrinhos | Lista carrinhos e contadores da conta |
| POST | /api/carrinhos | Cria vazio |
| PATCH | /api/carrinhos/:id | Renomeia |
| PUT | /api/carrinhos/:id/ativar | Persiste seleção |
| DELETE | /api/carrinhos/:id | Exclui e garante ativo válido |

Rotas /api/carrinho e /itens continuam funcionando sobre o ativo. Leitura inclui id/nome, totais e checkout_estado. Header opcional X-Carrinho-Id exige o ativo exibido: alheio → 404; seleção antiga → 409. POST /api/pedidos aceita carrinho_id e tentativa_id (UUID) opcionais, mantendo clientes antigos compatíveis.

### Decisões que o enunciado deixou abertas

| Pergunta | Sua decisão | Motivo |
|---|---|---|
| Limite | 10 por conta | Suficiente para orçamentos sem crescimento ilimitado |
| Apagar ativo | Promover o mais antigo restante | Seleção determinística e simples |
| Apagar último | Recriar padrão vazio | Evitar estado inválido |
| Vitrine | Painel lateral no desktop | Conferir itens mantendo catálogo utilizável |
| Celular | Drawer modal até 390 px de largura | Dar espaço aos controles, fechar e continuar navegando |
| Reentrada | Último ativo persistido | Retomar orçamento |
| Checkout | Limpar só itens do utilizado, manter nome/seleção | Preservar outros orçamentos e reutilizar carrinho |

### Isolamento

Toda consulta/ação verifica usuário autenticado e propriedade, com SQL parametrizado. IDs alheios não revelam dados. Limites, ativação e mudanças de itens usam transações curtas; inclusão/alteração verificam novamente o ativo e bloqueio depois do HTTP. Índices/foreign keys sustentam integridade. Contexto protege sessão e ordem de respostas; não substitui autorização backend.

### Checkout e concorrência

checkout_tentativas guarda UUID, usuário, carrinho, assinatura dos dados, estado, número ERP quando conhecido e datas. Índice parcial permite uma tentativa VALIDANDO/ENVIANDO/INCERTO por carrinho. Reserva ocorre antes de HTTP; nenhuma transação SQLite fica aberta na chamada externa.

Carrinho fica fixado antes da espera. Mutações de itens/exclusão dele são bloqueadas; outro pode ser ativado/utilizado. Renomeação não altera os itens do pedido. Depois do aceite, vínculo/snapshot, limpeza do capturado e conclusão da tentativa são uma transação local. Falha antes do envio ou recusa explícita preserva itens e libera edição.

Timeout, 5xx, resposta inválida ou falha local depois do aceite preservam itens e bloqueio para conferência. Número conhecido fica na tentativa/log. Queda de processo também não expira reserva automaticamente. UUID concluído retorna pedido existente; assinatura impede reutilizar com dados diferentes. Não há garantia exactly-once entre sistemas sem suporte do SIAC.

Auditoria independente manteve o mecanismo e acrescentou testes de dois usuários simultâneos e encerramento abrupto/reinício de processo nos estados VALIDANDO/ENVIANDO. Reservas continuam bloqueadas, sem reenvio. Tentativas nesses estados após manutenção também exigem conferência operacional; não é seguro presumir recusa pelo tempo decorrido.

---

## 5. Como testei

Testes node:test com SQLite temporário e ERP HTTP mock; fetch limitado a loopback. Navegador usa aplicação modificada pelo Vite e backend temporário. Nenhum pedido real foi gerado.

Validações anteriores: **51 backend + 25 navegador = 76**, **130 + 35 = 165** e **131 + 39 = 170 aprovados**. Saídas brutas históricas permanecem recuperáveis pelo Git, não na árvore atual. A regressão consolidada passou com **139 backend + 64 frontend = 203 testes**, sem falhas/cancelamentos/skips, em Node 24.21.0 com npm ci e 103 arquivos conferidos byte a byte. São seis unitários de máscaras e 58 testes de navegador, além do backend. Node 20.19.2 também aprovou 139+62 antes dos dois últimos casos adicionais de catálogo/chamados; a regressão posterior aprovou os 203. Build (63 módulos), smoke/reinício, scanner, auditorias npm, sintaxe, whitespace e links foram aprovados. Resultados e comandos em [VALIDACAO-FINAL.md](VALIDACAO-FINAL.md).

Cobertura: quatro chamados, migrações, autorização entre contas, múltiplos carrinhos, preço/estoque, checkout e concorrência; CORS, replay/expiração/concorrência de sessões, senhas com espaços/Unicode, rate limit/proxy, principal/telefone, ERP malformado/timeout/5xx/401, stream/logs e backup/restauração. Frontend modificado realmente executado em Chromium com mock isolado.

Dez telas em 360/390/768/1440 px: overflow, nomes/labels, botões e contraste de textos renderizados (canvas, fundos/opacity, extremos do gradiente). Drawer cobre Tab/Shift+Tab/Escape/retorno de foco; atalho pula ao conteúdo. Corrigi área de clique, observação sem nome acessível e opacidade da ajuda do e-mail. Capturas finais fictícias de produto/painel, com inspeção visual por imagem; não houve teste manual humano em dispositivo real ou certificação WCAG.

Comandos: backend npm test; frontend npm test/npm run build; node scripts/smoke-producao.mjs e verificar-segredos.mjs no backend; git diff --check; node --check; npm audit; systemd-analyze verify; caddy validate. Scanner verifica rastreados, novos não ignorados, blobs históricos e segredos conhecidos do ambiente, sem imprimir valores; não é garantia de ausência de todo segredo. npm audit não apontou vulnerabilidades conhecidas. Diagnóstico antigo não foi usado como aprovação. Health público do SIAC foi consultado na auditoria anterior; não validei catálogo autenticado real nesta revisão nem gerei pedido real.

Reproduções de bugs e falhas durante desenvolvimento estão registradas na validação. Só execuções completas aprovadas sustentam os números acima. Arquivos de teste rodam em sequência; casos de concorrência continuam exercitando requisições, conexões e processos simultâneos. A revisão retirou uma espera de 20 ms que não sincronizava de fato o teste e preservou sua barreira explícita.

---

## 6. Decisões e suposições

- Respeitar camada de regra no serviço, formato de erros e autenticação existentes.
- Sem ORM, catálogo local, dependência de UI, fila ou lock distribuído.
- playwright-core é dependência somente de desenvolvimento e usa navegador instalado.
- SQLite deve estar num volume persistente compartilhado pelos processos desta loja; múltiplas cópias independentes do banco não compartilham reservas.
- O SIAC ainda pode recusar estoque no POST. Mock não comprova sua atomicidade.
- Tentativas incertas/interrompidas precisam de conferência operacional. Não é seguro liberar por tempo e repetir sem idempotência externa.

---

## 7. O que faria com mais tempo

Idempotência/reconciliação por chave no SIAC e interface administrativa de conferência; publicar em infraestrutura autorizada e validar operação real; testar Safari/Firefox, carga e leitor de tela. Proteção de borda contra DDoS e políticas de retenção/backup externo dependem da infraestrutura.

---

## 8. Outras observações

Implantação e pendências operacionais em [IMPLANTACAO.md](IMPLANTACAO.md). Nenhum e-mail enviado.

Marcadores da base lidos: KZN-2B9C (configuração), KZN-7F3A (carrinho), KZN-5D1E (cabeçalho).

Histórico, autoria e datas do Git foram preservados. Documentos de organização interna foram consolidados; decisões técnicas e evidências relevantes permanecem nesta entrega. Não foram encontrados arquivos AGENTS.md/CLAUDE.md, Trellis, Codex ou Cursor na árvore do projeto. Nenhuma dependência foi adicionada. Implantação pública, rotação externa de credencial e conferência de pedidos continuam pendentes.

## 9. Ajustes após testes manuais — 12/10/2026

| Relato | Causa | Correção | Arquivos principais | Validação |
|---|---|---|---|---|
| Não consigo apagar quantidade; setas interrompem interação | Valor controlado pelo servidor e escrita/desabilitação a cada onChange | Rascunho local admite vazio; confirma por Enter/blur, valida 1–99 e serializa confirmações do mesmo campo. Mantém foco, restaura valor confirmado em erro e encerra fila ao desmontar/trocar carrinho | frontend/src/componentes/ItensCarrinho.jsx, ConteudoCarrinho.jsx | Digitação, vazio, inválidos, Tab, Enter, setas de teclado e cliques nativos na página/painel, resposta lenta e refresh |
| Falha intermitente de carrinho | Leituras de carrinho/lista podiam representar ativos diferentes; erro ocultava itens já carregados; retry mantinha alerta local | Confere identidade e seleção, relê uma vez se ativo divergir, recupera conflito sem repetir escrita, mantém itens/valores anteriores identificados e bloqueia checkout após falha de leitura | frontend/src/contextos/CarrinhoContext.jsx, componentes/ConteudoCarrinho.jsx | Leituras invertidas, seleção em duas abas, erro 502, indisponibilidade de backend, recuperação e sessão expirada |
| Troca de conta em outra aba | Cookie compartilhado, identidade React não compartilhada | BroadcastChannel notifica mudança após login/cadastro/logout; cada aba reconsulta identidade no servidor, remove estado antigo e informa falha de revalidação | frontend/src/contextos/AuthContext.jsx | Duas páginas Chromium com cookie compartilhado; login B e logout atualizam A sem apresentar itens da identidade anterior |
| Falha ao consultar estoque | Cada leitura consultava produtos em paralelo sem limite; chamadas simultâneas repetidas do mesmo código | Até seis consultas por lote no carrinho e compartilhamento somente de GETs em andamento do mesmo produto; sem cache de preço/estoque e sem retry de escrita | backend/src/services/carrinhoService.js, erp/cliente.js | 15 produtos, dez consultas simultâneas do mesmo produto, erro/recuperação, lentidão, timeout, 401/429/502/503/504 e JSON inválido |
| Campos brasileiros sem máscara | Inputs de texto sem formatação | Utilitários de CPF/CNPJ adaptativo, telefone 10/11 dígitos e CEP; edição por posição de dígitos, inputMode/autoComplete; envio somente de dígitos, validação backend preservada | frontend/src/lib/mascaras.js, componentes/ui.jsx, FormularioEndereco.jsx, paginas/Cadastro.jsx e Perfil.jsx | Unitários, digitação, Backspace/Delete em separadores, clipboard real, seleção/substituição, valores antigos e criação/edição de endereço |
| Cadastro/troca sem confirmação ou visibilidade | Formulários tinham somente uma entrada de senha nova | Confirmação local próxima ao campo, sem enviar confirmarSenha. Controle compartilhado inicialmente oculto, type=button, nome acessível e teclado; espaços e política existentes preservados | frontend/src/componentes/ui.jsx, paginas/Cadastro.jsx e Perfil.jsx | Iguais/diferentes/vazias, espaços/especiais, falha de API, sucesso, login posterior e revogação de cookie anterior |
| Paginação rápida após filtro | A URL já estava na primeira página, mas Próxima ainda usava a paginação anterior antes do efeito de loading | Ativa loading na própria mudança de critério; clicar novamente no filtro atual não inicia carregamento sem requisição | frontend/src/paginas/Catalogo.jsx | Regressão completa em Node 24 identificou página 3 em vez de 2; cenário de filtros e filtro repetido validado após correção |

Recuperação de senha **não implementada**. A conta é identificada por id e e-mail único;
documento não possui restrição UNIQUE. Não há transporte de e-mail, segredo de envio
ou canal de verificação configurado. CPF/CNPJ não prova identidade. Não foi criado
endpoint de troca por documento nem link que promete recuperação. A troca autenticada
continua exigindo senha atual e revogando sessões anteriores. Um fluxo futuro requer
canal de entrega autorizado, resposta genérica, token aleatório armazenado como hash,
expiração curta, uso único, limitação de tentativas e revogação transacional de sessões.

Diagnóstico real do SIAC em 12/10: base configurada teste-tecnico.kaizenautopecas.com.br,
timeout de 8000 ms preservado, credencial local presente. Apenas GETs autorizados:
/health HTTP 200/status ok em 561 ms; /produtos com tamanho=1 HTTP 200 em 886 ms;
/produtos/categorias HTTP 200 com nove categorias em 99 ms. Nenhum pedido real foi
enviado. Não reproduzi falha externa nesse pequeno conjunto; ele não demonstra
ausência de instabilidade, limite de tráfego ou atomicidade do SIAC.

No mock, 401 vira 502/ERP_NAO_AUTORIZADO; 429 e 5xx viram 502/ERP_INDISPONIVEL;
timeout/rede são falhas de integração; JSON inválido mantém 502/ERP_RESPOSTA_INVALIDA.
Logs de falha ERP incluem request-id da requisição iniciadora, template de rota,
método, categoria, status remoto e duração, sem código de produto, query, token,
cookie ou corpo. GETs simultâneos compartilhados têm um log remoto do iniciador;
logs HTTP da loja identificam cada resposta local. Não aumentei timeout nem
introduzi retry automático de pedido ou de mutação de carrinho.

Jornada Chromium usa conta criada pela interface, busca após paginação/filtros,
dois orçamentos com produtos distintos, digitação/setas/persistência, renomeação,
exclusão, dois endereços criados no perfil, endereço secundário no checkout mock,
preservação de outro carrinho, logout/outra conta e quatro larguras. Chamados
originais continuam nas suítes completas. Resultados atuais estão na seção 5; execuções intermediárias com falha não são contadas como aprovação.

## 10. Limpeza da entrega

| Inventário | Destino |
|---|---|
| Diagnóstico executável antigo | Removido: afirmava bugs da versão antiga; nenhuma suíte/execução/deploy atual dependia dele. Causas e reproduções relevantes permanecem nas seções 2/3 |
| Diagnóstico e validações intermediárias | Consolidados neste relatório e em VALIDACAO-FINAL.md; referências/comandos antigos removidos |
| Preparação pessoal e rascunho de e-mail | Removidos; decisões técnicas já constavam no relatório. Nenhuma mensagem foi enviada |
| Guia de implantação | IMPLANTACAO.md na raiz preserva host, configuração, backup/restauração e conferência de pedidos |
| Validação da entrega | VALIDACAO-FINAL.md na raiz preserva baseline, comandos, cobertura e limites |
| Evidências históricas | Removidos todos os 17 arquivos restantes: 11 PNG e seis TXT. Causas/resultados estão consolidados nos documentos da raiz e arquivos continuam recuperáveis pelo Git |
| Diretório auxiliar | Completamente excluído por solicitação final. Capturas opcionais dos testes usam pasta temporária ou EVIDENCIAS_DIR, sem recriar a estrutura antiga |
| deploy/ | Três arquivos úteis preservados: kaizen.service, kaizen.env.example e Caddyfile. Não há configuração obsoleta/duplicada demonstrada |
| Artefatos de agentes | Busca recursiva fora de Git/dependências não encontrou AGENTS.md, CLAUDE.md, .trellis, .codex, .cursor, prompts ou checkpoints do projeto |

README original, licença, arquitetura, relatório obrigatório, lockfiles, testes,
migrações e scripts de inicialização/backup/smoke/segredos foram preservados.
Referências de organização por dias foram retiradas; histórico Git, autoria e
origem dos requisitos não foram reescritos. Arquivos removidos são recuperáveis
no histórico. A análise dos 17 artefatos finais não identificou informação técnica
indispensável ausente dos documentos da raiz. Nenhum teste foi removido.

Regressão após os merges na main: **139 backend + 64 frontend = 203 aprovados**
também em Node 20.19.2, sem falhas/cancelamentos/skips. Build Vite de 63 módulos,
smoke/reinício, scanner (arquivos/histórico), auditorias npm sem vulnerabilidades
conhecidas, links e git diff --check aprovados. Código funcional não mudou
durante o registro final desses resultados.

O workspace inicial estava limpo, mas arquivos/diretórios criados por root
bloqueavam Git/edição. Cópias preservadas fora do repositório permitiram reparar
a escrita sem perder histórico/configuração. O backend local já aberto também
executa como root e não foi reiniciado. backend/data, ignorado pelo Git, aponta
ao diretório original preservado em /home/henrique/DEV/kaizen-tree-permissions.eyJrXl/backend-original/data;
assim seu banco/WAL continuam sendo os mesmos usados pelo processo. O .env foi
comparado e permanece idêntico. Regressão e smoke não tocaram nesse banco privado.
