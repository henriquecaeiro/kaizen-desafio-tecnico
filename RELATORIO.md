# Relatório de entrega

**Candidato:** Henrique Caeiro
**Data de entrega:** 11/10/2026 (publicação técnica; envio à empresa e implantação pública ainda pendentes).
**Tempo aproximado dedicado:** não cronometrado.

Chamados, múltiplos carrinhos e auditoria final implementados/testados. Diagnóstico histórico em [DIAGNOSTICO-DIA1.md](docs/DIAGNOSTICO-DIA1.md); resultados anteriores preservados em [VALIDACAO-DIAS2-3.md](docs/VALIDACAO-DIAS2-3.md). Resultados atuais em [VALIDACAO-FINAL.md](docs/VALIDACAO-FINAL.md). **Entrega parcial somente pela implantação pública:** faltam host/acesso/domínio e credencial de produção autorizados; não há URL pública da solução.

---

## 1. Subindo o projeto

Dia 1 executado em Windows/Node 24 LTS. Dias 2 e 3 e revisão final no workspace Linux, inicialmente Node 20.19.2 e Chromium instalado. Confirmei main/remoto e merges anteriores; não encontrei o workspace Windows montado. Validação final adicional com Node 24.21.0 de .nvmrc, em cópia isolada com npm ci nos dois projetos, sem substituir dependências do workspace. Execução no README; segredos somente no ambiente.

npm run db:init ou bootstrap aplica migrações 001–005, sem db:reset. Fixtures usam SQLite temporário; nenhum banco real foi resetado ou publicado. Em produção, Express serve frontend/dist na mesma origem e recusa iniciar sem build. Serviço systemd/Caddy, variáveis privadas, backup online/restauração e atualização estão em [IMPLANTACAO.md](docs/IMPLANTACAO.md). Configurações e produção local foram validadas; host público não foi disponibilizado. Não criei cobrança nem usei infraestrutura pessoal/corporativa.

Push HTTPS falhou por falta de credencial no ambiente. Chave SSH existente autenticou na conta de Henrique e permitiu publicar as branches/main. Nenhum push foi dirigido ao repositório da empresa. package-lock.json não versionado na raiz já existia e foi preservado.

---

## 2. Chamados reportados

### KZN-312 — Total do carrinho vem maior que a soma das peças

| | |
|---|---|
| **Causa** | O serviço somava subtotais de todas as linhas, inclusive pendentes. Math.floor na conversão monetária perdia centavos (1.15 → 114). |
| **Como reproduzi** | Dia 1: radiador sem estoque 684 + disponíveis 110 → total 794. |
| **Correção** | valor_total soma somente linhas disponíveis; valor_itens mantém soma das linhas conhecidas. Linha mantém valor_total e recebe valor_elegivel. Sem remoção/redução automática. Checkout exige resolver todas as pendências. |
| **Arquivos alterados** | carrinhoService.js, dinheiro.js, Carrinho.jsx/ItensCarrinho.jsx; backend/tests/carrinho.test.mjs e dinheiro.test.mjs. |
| **Como validei** | Vazio, disponíveis, zero/parcial/inativo/404, falha ERP, quantidades e centavos; pendência bloqueia pedido. Conversão arredonda meio centavo para cima, somas usam preço em centavos × quantidade, sem reconverter subtotais. |

Falha de consulta é erro, não carrinho vazio; somente produto ausente vira pendência. Um item sem preço conhecido tem valor zero informado, sem permitir compra.

### KZN-318 — Número no ícone do carrinho está errado

| | |
|---|---|
| **Causa** | quantidade_pecas usava itens.length; contexto também ignorava mudanças da sessão. |
| **Como reproduzi** | Dia 1: FIL=3 e SUS=4 → duas peças; logout/login B manteve estado visual de A. |
| **Correção** | Serviço soma unidades, inclusive pendentes; quantidade_itens continua contando produtos distintos. Contexto limpa/recarrega por identidade e aceita somente requisição atual da mesma sessão. AuthContext descarta consulta inicial da sessão quando um login/cadastro/logout mais recente já terminou. |
| **Arquivos alterados** | carrinhoService.js, CarrinhoContext.jsx e consumidores; testes de carrinho/sessão. |
| **Como validei** | 3+4=7, inclusão repetida, alteração, remoção/limpeza, login/logout/troca, resposta antiga de sessão e leitura anterior a mutação. Erro de leitura tem estado e opção de repetir. |

Cabeçalho consome o contador do backend, sem cálculo duplicado. A auditoria final acrescentou revogação de sessões persistidas, além da consistência visual.

### KZN-325 — Busca diz que não encontrou peça que existe

| | |
|---|---|
| **Causa** | Busca/filtros preservavam pagina anterior. Próxima comparava pagina com total_paginas - 1. Campo não acompanhava URL. |
| **Como reproduzi** | Dia 1: /?pagina=2&busca=amortecedor tinha lista vazia, apesar de resultados na página 1. |
| **Correção** | Mudar critérios remove pagina, preservando demais filtros; paginar conserva critérios. Campo acompanha termo da URL. Próxima desabilita na última página. |
| **Arquivos alterados** | Cabecalho.jsx, Catalogo.jsx, ui.jsx; frontend/tests/catalogo.test.mjs. |
| **Como validei** | Busca inicial/depois de paginar, categoria/disponibilidade/limpeza, combinações, URL, back/forward/refresh, 1/2/3 páginas, Pedidos até terceira página e resposta atrasada. |

O catálogo já descartava respostas de efeitos encerrados. Esse comportamento foi preservado e testado; não acrescentei ciclos de atualização.

### KZN-331 — Pedido saiu com o endereço errado

| | |
|---|---|
| **Causa** | Radio alterava enderecoId, mas finalizar buscava novamente o principal. |
| **Como reproduzi** | Dia 1 com mock: Oficina selecionada; payload/snapshot recebiam Casa. Contraprova backend já respeitava ID. |
| **Correção** | Frontend envia enderecoId; principal só define seleção inicial. |
| **Arquivos alterados** | Checkout.jsx; testes backend/frontend de checkout. |
| **Como validei** | Único, principal/secundário, recém-criado, excluído em outra aba, alheio, snapshot/observação, edição posterior e falha de estoque. |

Backend não precisou mudar para corrigir endereço: autenticação, propriedade e snapshot foram preservados. Sua alteração posterior no Dia 3 trata carrinho e concorrência.

---

## 3. Problemas que encontrei por conta própria

Evidências originais e prioridades estão na auditoria do Dia 1.

| Achados relacionados | Tratamento nos Dias 2 e 3 |
|---|---|
| A02 dinheiro | Arredondamento central e inteiros; inválidos rejeitados. |
| A03/A20 sessão e respostas | Contexto vinculado à identidade/requisição; erro separado de vazio. |
| A04/A05 checkout duplicado/perda de itens | Reserva persistente por carrinho; mutações bloqueadas, limpeza somente do capturado. |
| A06 resposta perdida depois de aceite | Itens/bloqueio preservados; tentativa incerta requer reconciliação. Não resolve transação distribuída. |
| A08/A17 paginação/campo | Correções compartilhadas e sincronização com URL. |
| A09 estoque parcial | Quantidade pode ser reduzida mesmo com pendência; backend revalida. |
| A14/A15 entrada e saturação | Validação rejeita booleano/array e inteiro inseguro; somar acima de 99 dá conflito, sem sucesso parcial. |
| A18 layout | Header/grid responsivos e painel testados em 360/390/768/1440 px. |
| A16 contrato ERP | Criação valida número/total; auditoria final valida produto, catálogo/paginação, categorias, detalhe, health e imagens. |

A01 teve remoção de segredos no Dia 1; rotação externa não foi realizada. Na auditoria final foram corrigidos A07 (origens CORS exatas e proxies explícitos), A10 (telefone vazio/null versus omitido), A11 (principal em transação e índice único), A12 (senhas sem trim), A13 (JWT com sessão revogável), A16 (contratos de leitura), A19 (limites persistidos por conta/IP), A21 (retry e limpeza de erro em pedidos) e A22 (streams e logs sem query/corpo remoto).

Migrações 003/004 criam sessoes e autenticacao_limites; 005 normaliza seleção de endereço sem alterar conteúdo/datas e cria índice parcial. Logout revoga apenas aquela sessão. Troca de senha revoga todas as anteriores e renova o cookie atual. JWT sem registro/jti é rejeitado. Login confere novamente o hash antes de abrir sessão; trocas concorrentes usam comparação do hash na atualização. Respostas 401 antigas não apagam cookie de login mais recente. Requisições já autorizadas em andamento não são canceladas.

Login: 30/IP e 10/conta em 15 minutos; cadastro: 5/IP por hora; senha: 10/IP e 5/conta em 15 minutos. Contadores incluem sucesso e payload inválido, expiram, usam chaves SHA-256 e sobrevivem a reinício. Podem restringir usuários atrás de NAT ou permitir bloqueio temporário dirigido a uma conta; não substituem proteção contra DDoS na borda. TRUST_PROXY é vazio por padrão, ignorando X-Forwarded-For.

Leituras ERP inválidas retornam 502. Histórico mantém dados locais com status explicitamente indisponível e opção de repetir. Imagens validam tipo/corpo e encerram o stream em falha. Scanner percorre arquivos e blobs históricos, sem exibir valores; é verificação heurística, não certificação de ausência de segredo. A credencial fictícia conhecida do diagnóstico não é credencial SIAC.

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

Histórico preservado: Dia 2 integrado 23 backend/12 navegador; Dias 2/3 finais **51 + 25 = 76 aprovados**. Reexecução inicial confirmou os 76. Auditoria final ampliou para **130 backend + 35 navegador = 165 testes**, sem falhas/skips na execução aprovada, incluindo Node 24.21.0 com instalação limpa. Build Vite (62 módulos) e smoke de produção/reinício aprovados. Saídas e comandos em [VALIDACAO-FINAL.md](docs/VALIDACAO-FINAL.md).

Cobertura: quatro chamados, migrações, autorização entre contas, múltiplos carrinhos, preço/estoque, checkout e concorrência; CORS, replay/expiração/concorrência de sessões, senhas com espaços/Unicode, rate limit/proxy, principal/telefone, ERP malformado/timeout/5xx/401, stream/logs e backup/restauração. Frontend modificado realmente executado em Chromium com mock isolado.

Dez telas em 360/390/768/1440 px: overflow, nomes/labels, botões e contraste de textos renderizados (canvas, fundos/opacity, extremos do gradiente). Drawer cobre Tab/Shift+Tab/Escape/retorno de foco; atalho pula ao conteúdo. Corrigi área de clique, observação sem nome acessível e opacidade da ajuda do e-mail. Capturas finais fictícias de produto/painel, com inspeção visual por imagem; não houve teste manual humano em dispositivo real ou certificação WCAG.

Comandos: backend npm test; frontend npm test/npm run build; node scripts/smoke-producao.mjs e verificar-segredos.mjs no backend; git diff --check; node --check; npm audit; systemd-analyze verify; caddy validate. Scanner verifica arquivos/blobs do histórico e segredos conhecidos do ambiente, sem imprimir valores. npm audit não apontou vulnerabilidades conhecidas na execução. Diagnóstico antigo não foi usado como aprovação. Health público do SIAC teve consulta somente leitura 200/ok; não validei catálogo autenticado real nesta etapa nem gerei pedido real.

Falhas de desenvolvimento foram registradas: seletores iniciais incorretos, alvos pequenos/label/contraste corrigidos; teste de restauração esperava carrinho de usuário que ainda não havia acessado; fixture ajustada para exercitar esse acesso. Um mock excedeu timeout de 250ms com muitos arquivos concorrentes. Suítes passaram após serializar arquivos; concorrência de requisições/conexões/processos continua dentro dos casos. Essas execuções falhas/interrompidas não foram usadas como aprovação.

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

[ENTREVISTA-DIAS2-3.md](docs/ENTREVISTA-DIAS2-3.md) é histórico. Decisões atuais em [ENTREVISTA-FINAL.md](docs/ENTREVISTA-FINAL.md); pendências reais em [PENDENCIAS-DIA4.md](docs/PENDENCIAS-DIA4.md); mensagem pronta para revisão em [EMAIL-ENTREGA.md](docs/EMAIL-ENTREGA.md). Nenhum e-mail enviado.

Marcadores da base lidos: KZN-2B9C (configuração), KZN-7F3A (carrinho), KZN-5D1E (cabeçalho).

Histórico inicial e commits anteriores preservados; branches separadas e merges no-ff. Auditoria em fix/security-and-integrity; preparação/documentação em chore/deployment-and-delivery; integração na main do repositório público de Henrique, sem force-push. package-lock.json não versionado preexistente na raiz não faz parte da entrega. Meta interna 12/10 à noite; prazo oficial 13/10 às 15h Brasília. Implantação é o requisito bloqueante restante: não declarar entrega 100% concluída sem URL real validada. Rotação SIAC e conferência de pedidos permanecem responsabilidades externas explicitadas.
