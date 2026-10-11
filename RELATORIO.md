# Relatório de entrega

**Candidato:** Henrique Caeiro
**Data de entrega:** em preparação; Dias 2 e 3 executados em 10/10/2026 (Brasília).
**Tempo aproximado dedicado:** não cronometrado.

Dias 2 e 3 implementados. Diagnóstico histórico em [DIAGNOSTICO-DIA1.md](docs/DIAGNOSTICO-DIA1.md); comandos/resultados em [VALIDACAO-DIAS2-3.md](docs/VALIDACAO-DIAS2-3.md). Implantação pública e auditoria do Dia 4 ainda pendentes.

---

## 1. Subindo o projeto

Dia 1 executado em Windows/Node 24 LTS. Dias 2 e 3 no workspace Linux, Node 20.19.2 compatível com engines, npm e Chromium instalado. Instalação com npm ci em backend/frontend; better-sqlite3 compilado localmente. Execução e testes estão no README. Configurar backend/.env a partir de .env.example, sem publicar segredos.

npm run db:init ou início do servidor aplica migrações, sem db:reset. Não alterei banco existente para testar; fixtures usam SQLite temporário. Não existe implantação pública da solução ainda. Em produção, o backend serve frontend/dist na mesma origem.

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

Cabeçalho consome o contador do backend, sem cálculo duplicado. A correção visual não revoga JWT antigo; revogação permanece no Dia 4.

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
| A16 contrato ERP | Criação de pedido valida número/total. Outras leituras ainda exigem revisão. |

A01 teve remoção de segredos no Dia 1; rotação externa não foi realizada. CORS refletido, revogação JWT, limitação de autenticação, senhas com espaços, endereço principal, telefone e demais achados independentes não foram antecipados. Pendências priorizadas em [PENDENCIAS-DIA4.md](docs/PENDENCIAS-DIA4.md).

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

---

## 5. Como testei

Testes node:test com SQLite temporário e ERP HTTP mock; fetch limitado a loopback. Navegador usa aplicação modificada pelo Vite e backend temporário. Nenhum pedido real foi gerado.

Dia 2 integrado: 23 testes backend e 12 navegador aprovados; build aprovado. Suíte final dos Dias 2/3: **51 backend + 25 navegador = 76 aprovados, zero falhas/skips**. Build e smoke do bootstrap production aprovados. Resultados/saídas em [VALIDACAO-DIAS2-3.md](docs/VALIDACAO-DIAS2-3.md). Cobertura de migração, isolamento de dois usuários, gestão/limites, itens/preço/estoque, checkout, concorrência HTTP/duas conexões, falha local/timeout após aceite, sessão, URL e quatro larguras. Screenshots fictícios em docs/evidencias/dia3-carrinho-*.png.

Comandos: backend npm test; frontend npm test e npm run build; git diff --check; node backend/scripts/verificar-segredos.mjs. O diagnóstico histórico afirma bugs anteriores e não é evidência de regressão aprovada. Não executei escrita no SIAC real, carga, Safari/Firefox ou produção pública.

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

Idempotência/reconciliação por chave no SIAC, fluxo administrativo de conferência, auditoria de sessões/CORS e autenticação, validação dos contratos de leitura, testes em outros navegadores e operação com backup/restauração.

---

## 8. Outras observações

[ENTREVISTA-DIAS2-3.md](docs/ENTREVISTA-DIAS2-3.md) resume as decisões do código. [PENDENCIAS-DIA4.md](docs/PENDENCIAS-DIA4.md) organiza segurança, problemas ocultos, implantação obrigatória e revisão final. Não foi criada branch de auditoria nem enviado e-mail.

Marcadores da base lidos: KZN-2B9C (configuração), KZN-7F3A (carrinho), KZN-5D1E (cabeçalho).

Histórico inicial e commits do Dia 1 preservados; branches separadas e merges no-ff. Meta interna 12/10 à noite; prazo oficial 13/10 às 15h Brasília. Entrega pública ainda exige hospedagem e validação do Dia 4.
