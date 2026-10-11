# Relatório de entrega

**Candidato:** Henrique Caeiro
**Data de entrega:** em preparação; registro do Dia 1 em 09/10/2026 (Brasília).
**Tempo aproximado dedicado:** não cronometrado; não estimado como evidência.

Implementação dos Dias 2 e 3 em andamento. A investigação original e suas reproduções históricas estão em [DIAGNOSTICO-DIA1.md](docs/DIAGNOSTICO-DIA1.md); esse diagnóstico não é uma suíte de regressão.

---

## 1. Subindo o projeto

Aplicação executada localmente com Node 24.21.0 LTS, npm 11.19.0 e SQLite/better-sqlite3. Backend em `http://127.0.0.1:3001`; frontend Vite em `http://127.0.0.1:5173`. Backend, frontend, banco, proxy e SIAC responderam corretamente nas verificações de leitura. **Ainda não há implantação pública da solução.**

Com Node 24 no PATH, comandos efetivamente utilizados:

```powershell
# Terminal backend
cd C:\DEV\teste-tecnico-kaizen\backend
npm ci
npm run db:init
npm start

# Outro terminal, frontend
cd C:\DEV\teste-tecnico-kaizen\frontend
npm ci
npm run dev -- --host 127.0.0.1

# Build, no frontend
npm run build

# Diagnóstico seguro, no backend
node scripts/diagnostico-dia1.mjs
# Reprodução visual com ERP simulado, em processo separado
node scripts/diagnostico-dia1.mjs --servir
```

Os manifests não oferecem testes ou lint. Backend também dispõe de `npm run dev` (watch), frontend de `npm run preview`. `db:reset` é destrutivo e não foi usado.

Dificuldades: máquina estava no Node 26.5.0; instalado Node 24 LTS local sem substituir o global. Código esperava ERP_URL/ERP_TOKEN e tinha segredos fixos: removidos e adicionados SIAC_URL/SIAC_TOKEN, mantendo aliases antigos. Ausência de segredo/token agora bloqueia inicialização, conferida em processo sem `.env`. Os avisos de npm sobre scripts nativos não impediram SQLite/build.

Arquivos criados: `.nvmrc`, complementos no `.gitignore`, `backend/.env` **ignorado** com segredo JWT aleatório e credencial SIAC, novo banco de desenvolvimento ignorado, diagnóstico reproduzível e documentação/evidências. `.env.example` atualizado sem credenciais. SIAC_URL utilizada: `https://teste-tecnico.kaizenautopecas.com.br`.

`/health` do SIAC e `/api/health` direto/por proxy retornaram 200. Catálogo autenticado retornou 55 produtos e nove categorias na observação. Nenhum pedido foi criado no SIAC real: checkout testado exclusivamente contra mock de loopback.

---

## 2. Chamados reportados

### KZN-312 — Total do carrinho vem maior que a soma das peças

| | |
|---|---|
| **Causa** | Confirmada: enriquecerItens mantém subtotal de item sem estoque e lerCarrinho soma todos, incluindo indisponíveis, em backend/src/services/carrinhoService.js. |
| **Como reproduzi** | SQLite temporário + ERP mock: radiador sem estoque 1 × 684, filtro 3 × 10 e amortecedor 4 × 20. Total 794; soma elegível 110; diferença 684. Checkout bloqueou corretamente. |
| **Arquivos alterados** | carrinhoService.js, dinheiro.js, Carrinho.jsx; testes em backend/tests/carrinho.test.mjs e dinheiro.test.mjs. |
| **Como validei a correção** | Testes node:test com SQLite temporário e ERP HTTP simulado; build Vite. Total elegível 110 com radiador pendente; checkout continua bloqueado. |

O serviço retorna `valor_total` elegível e `valor_itens` de todas as linhas conhecidas. Cada linha mantém `valor_total` e recebe `valor_elegivel`; indisponíveis são identificadas como fora do total na tela. Estoque parcial deixa a linha inteira pendente, sem remover ou reduzir quantidades. Falhas de consulta ERP são erros; 404 vira pendência visível. A conversão central arredonda meio centavo para cima e as somas usam preço em centavos × quantidade, evitando reconversão de subtotais.

### KZN-318 — Número no ícone do carrinho está errado

| | |
|---|---|
| **Causa** | Confirmada: lerCarrinho usa itens.length também para quantidade_pecas. Contexto, badge e resumo apenas exibem esse campo. |
| **Como reproduzi** | FIL=3 e SUS=4 retornaram quantidade_pecas=2; UI após F5 exibiu 2 no badge/resumo, embora haja 7 unidades. |
| **Arquivos alterados** | carrinhoService.js e testes de carrinho; CarrinhoContext.jsx para sincronização de sessão. |
| **Como validei a correção** | node:test: 3+4=7, inclusão repetida, alteração, remoção, limpeza e pendências. Testes de navegador cobrem login/logout/troca e respostas antigas. |

A soma de unidades é feita no serviço, inclusive para linhas pendentes; `quantidade_itens` continua contando produtos distintos. O cabeçalho consome o valor do backend sem cálculo próprio.

### KZN-325 — Busca diz que não encontrou peça que existe

| | |
|---|---|
| **Causa** | Confirmada: Cabecalho.pesquisar mantém pagina da query anterior. Catalogo.trocarParametro também não reinicia pagina ao mudar filtros. |
| **Como reproduzi** | Navegador com SIAC real: Próxima → página 2 → pesquisar amortecedor. URL ficou /?pagina=2&busca=amortecedor, lista vazia. HTTP confirmou total=3/total_paginas=1, e três resultados na página 1. |
| **Arquivos alterados** | Cabecalho.jsx, Catalogo.jsx, ui.jsx; frontend/tests/catalogo.test.mjs. |
| **Como validei a correção** | Chromium com aplicação modificada e ERP mock: busca após página 2, filtros combinados, limpeza, histórico, refresh, 1/2/3 páginas e resposta atrasada. |

Busca, categoria e disponibilidade removem `pagina`, preservando demais critérios. Navegação de página mantém os filtros. O campo acompanha o termo da URL por efeito dependente somente desse termo. Próxima desabilita na última página; o componente compartilhado continua usado em Pedidos. O catálogo já descartava respostas de efeitos encerrados; teste controlado confirma essa proteção.

### KZN-331 — Pedido saiu com o endereço errado

| | |
|---|---|
| **Causa** | Confirmada: Checkout.finalizar ignora enderecoId selecionado e envia id do endereço principal/primeiro. |
| **Como reproduzi** | UI isolada: Casa principal, selecionar Oficina, confirmar. Pedido MOCK-1 exibiu Casa e mock recebeu observação com Casa. Chamada direta do serviço com id da Oficina enviou/gravou Oficina corretamente. |
| **Arquivos alterados** | Checkout.jsx; backend/tests/checkout.test.mjs e frontend/tests/checkout.test.mjs. |
| **Como validei a correção** | Checkout visual com Oficina, observação recebida pelo mock e snapshot SQLite; endereço único, criado, excluído/alheio, edição posterior e recusa de estoque no backend. |

O frontend envia `enderecoId` selecionado. Principal serve apenas de seleção inicial. O backend já verificava propriedade, guardava snapshot e incluía endereço na observação; não precisou de alteração neste chamado. Endereço excluído em outra aba retorna erro e preserva o carrinho.

---

## 3. Problemas que encontrei por conta própria

### Problema 1

| | |
|---|---|
| **O que está errado** | P0: credenciais fixas e fallback de segredo JWT em config.js original. |
| **Como cheguei nele** | Leitura da configuração, marcador KZN-2B9C; ausência de ambiente não impedia uso de credenciais embutidas. |
| **Impacto** | Republicação de segredo ERP; assinatura de sessão possível se segredo público estiver em uso. Não houve exploração externa. |
| **Corrigi?** | Sim, somente configuração/importação: removidos valores fixos, aliases SIAC, `.env` ignorado, novo JWT local. A credencial externa não foi revogada; rotação depende do responsável pelo SIAC. |
| **Arquivos alterados** | backend/src/config.js, backend/.env.example, .gitignore, .nvmrc. |

### Problema 2

| | |
|---|---|
| **O que está errado** | P1: Math.floor na conversão monetária perde centavos. |
| **Como cheguei nele** | Execução real de paraCentavos(1.15) retornou 114. |
| **Impacto** | Divergência de preço/subtotal/total e vínculo local de pedido. |
| **Corrigi?** | Sim. Arredondamento explícito, rejeição de valores inválidos e cálculos em centavos inteiros. |
| **Arquivos alterados** | backend/src/lib/dinheiro.js e backend/tests/dinheiro.test.mjs. |

### Problema 3

| | |
|---|---|
| **O que está errado** | P1: carrinho não acompanha login/logout/troca de usuário. |
| **Como cheguei nele** | Login A mostrou vazio até F5; após sair e entrar B sem F5, UI mostrou itens/total anteriores da A. API de B continuou vazia. |
| **Impacto** | Exposição visual de seleção de outro usuário no mesmo navegador e estado enganoso. Não foi comprovado acesso cruzado na API. |
| **Corrigi?** | Sim. Contexto depende da identidade autenticada; limpa no logout, recarrega no login e aceita somente a requisição atual da mesma sessão. Falha de leitura tem estado próprio e opção de repetir. |
| **Arquivos alterados** | CarrinhoContext.jsx, Carrinho.jsx, Checkout.jsx e frontend/tests/sessao.test.mjs. |

Outros achados, com localização, reprodução, impacto, recomendação e prioridade na [auditoria detalhada](docs/DIAGNOSTICO-DIA1.md#auditoria-adicional):

- **P1, reproduzidos:** checkout simultâneo duplica pedidos; item adicionado durante espera do ERP é apagado; timeout após aceite remoto deixa pedido sem vínculo; CORS reflete origem arbitrária com credenciais (exploração em navegador não afirmada); sessão antiga permanece válida após troca de senha/logout.
- **P2, reproduzidos:** Próxima bloqueia antes da última página; não é possível limpar telefone; endereço pode ficar sem principal; senha cadastrada com espaços não entra; booleano/array aceitos como quantidade; 98+5 satura silenciosamente em 99; JSON inválido do ERP vira catálogo vazio; limpar busca não limpa texto do campo.
- **Confirmado por leitura, sem reprodução visual:** quantidade fica bloqueada quando estoque é insuficiente, impedindo reduzir para o disponível.
- **Suspeitas/risco ainda sem reprodução:** resposta antiga sobrescrever carrinho, layout móvel, recuperação visual após erro em pedidos, falha de stream de imagem. Ausência de rate limit e trust proxy irrestrito foram identificados por inspeção, sem teste de exploração.

Não alterei os fluxos funcionais desses achados hoje. Não tratei limites declarados de produto (sem pagamento, recuperação de senha, verificação de dígitos CPF/CNPJ etc.) como descobertas novas.

---

## 4. Múltiplos carrinhos

### Como ficou

Não implementado no Dia 1, conforme escopo. Existe um carrinho implícito por usuário.

### Modelagem

Tabela `carrinhos`: id, usuario_id, nome (1–80 caracteres), ativo e datas. Índice único parcial limita um ativo por usuário. `carrinho_itens` referencia carrinho com cascade e UNIQUE(carrinho_id, codigo_produto), guardando somente código, quantidade e data. Preço/estoque continuam no SIAC.

`schema.sql` permanece como base v0. Migração 001 cria um padrão por usuário existente e transfere itens preservando ids, códigos, quantidades e datas. `PRAGMA user_version` controla execução única. Inicialização e migrações rodam na mesma transação IMMEDIATE; inconsistência, perda de linhas ou falha referencial causam rollback. Sem db:reset. Testes: banco novo/antigo, com/sem itens, repetição, cascade, índice de ativo e rollback com item órfão.

Mudanças no contrato da API — endpoints novos ou alterados:

| Método | Rota | O que faz |
|---|---|---|
| GET | /api/carrinhos | Lista nomes, ativo e contadores da conta autenticada |
| POST | /api/carrinhos | Cria carrinho vazio, mantendo o ativo atual |
| PATCH | /api/carrinhos/:id | Renomeia |
| PUT | /api/carrinhos/:id/ativar | Persiste a seleção |
| DELETE | /api/carrinhos/:id | Exclui e garante um ativo válido |

As rotas `/api/carrinho` e `/api/carrinho/itens` operam sobre o ativo. Resposta de leitura inclui id/nome. Header opcional `X-Carrinho-Id` exige que o ativo seja o mesmo exibido pelo cliente; id alheio é 404, seleção antiga é 409. Consulta, ativação e mutações usam usuário autenticado e parâmetros SQL. Não há rota pública para itens de carrinho arbitrário. Inclusão verifica novamente a seleção depois da consulta externa, em transação curta. Limite de quantidade não satura silenciosamente; tipos booleano/array são rejeitados na validação central.

### Decisões que o enunciado deixou abertas

| Pergunta | Sua decisão | Motivo |
|---|---|---|
| Quantos carrinhos por pessoa? Tem limite? | Pendente para desenho da funcionalidade. | Não antecipar implementação/decisão sem avaliar fluxo. |
| O que acontece ao apagar o carrinho ativo? | Pendente. | Exige política de seleção e persistência. |
| Como o carrinho aparece na vitrine? | Pendente. | Desenho previsto para a etapa da funcionalidade. |
| E no celular? | Pendente. | Validar responsividade e espaço útil. |
| Qual carrinho vem selecionado ao entrar? | Pendente. | Precisa definir persistência por usuário e entre dispositivos. |
| O que acontece com os carrinhos após fechar um pedido? | Pendente. | Checkout deve fechar só o ativo, preservando os demais. |

### Isolamento

Hoje serviços filtram usuario_id; testes negaram endereço/pedido alheio e retornaram carrinho vazio para B. O frontend retém estado antigo entre sessões, problema documentado acima. Na nova modelagem será necessário verificar posse de carrinho, itens e checkout em todas as operações, com migração que preserve vínculo por usuário.

---

## 5. Como testei

- Instalações com lockfiles: npm ci; auditoria automática de ambos reportou zero vulnerabilidades naquele momento. Isso não equivale a auditoria de segurança completa.
- SQLite original e novo: contagens sem ler dados pessoais, integrity_check=ok, foreign_key_check=[], user_version=0. Ambos vazios antes dos testes; testes usam banco próprio temporário.
- Health SIAC/backend/proxy 200; catálogo e categorias reais por leitura autenticada; build Vite concluído (58 módulos).
- Script de diagnóstico: **20 grupos de evidências**, exit 0; configuração, SQLite, KZN-312/318, contraprova KZN-331, dinheiro, isolamento, CORS, perfil/endereço, senhas/sessão, validação/limites, tradução de erros, JSON inesperado, estoque no checkout e corridas/timeout.
- Navegador: KZN-325 com SIAC real; KZN-318/331 e estado entre contas com mock. Três screenshots fictícios guardados em docs/evidencias.
- Configuração sem credenciais em processo isolado: fail-fast confirmado; nenhum valor impresso.
- Comparação com origem, normalizando CRLF: regras de negócio e componentes preservados. Alterações de configuração: config.js/.env.example; README só teve remoção de whitespace para verificação do diff.
- Verificação dos arquivos candidatos a commit contra valores de segredos conhecidos e revisão dos arquivos ignorados. Nenhum segredo encontrado nos arquivos da entrega.

Como executar o diagnóstico automatizado:

```powershell
cd backend
node scripts/diagnostico-dia1.mjs
```

**Este script registra bugs existentes, não afirma que foram corrigidos.** As expectativas precisam ser convertidas em testes do comportamento correto durante as correções. Checkout só pode sair para 127.0.0.1 nesse script. Sem testes end-to-end de produção, carga, viewport móvel ou escrita real no ERP.

---

## 6. Decisões e suposições

- Preservar commit inicial já existente no repositório de entrega, README antigo e licença, sem importar história da empresa nem fazer force-push. Desenvolvimento do Dia 1 em codex/dia1-preparacao, com integração por fast-forward na main.
- Remoção de credenciais é requisito de preparação, não correção antecipada dos chamados. Não copiar banco ou dist para Git. Manter lockfiles e código funcional da base.
- Separar ambiente real de leitura e ambiente isolado de checkout. Dados fictícios do mock não provam comportamento interno/atomicidade do SIAC.
- KZN-312: recomendação é total elegível, com pendências preservadas e checkout bloqueado; indisponibilidade parcial não implica comprar quantidade menor automaticamente.
- KZN-318: unidades incluem itens ainda presentes com pendência; disponibilidade é campo separado. Confirmar decisão ao implementar.
- Discordâncias: fallbacks secretos, CORS refletido e perda de centavos contradizem as garantias descritas na arquitetura. Diagnóstico cita comportamento do código, não assume que documentação prova segurança.

---

## 7. O que faria com mais tempo

1. Checkout idempotente com tentativas persistidas/reconciliação; proteção de concorrência e testes de falha após aceite remoto, dentro do contrato disponível do SIAC.
2. Robustez de sessão, validação, limitação de autenticação e tratamento de contratos inválidos; testes de regressão para achados priorizados.
3. Operação: migrações, observabilidade sem dados sensíveis, backup/restauração SQLite, testes de implantação e responsividade/acessibilidade.

---

## 8. Outras observações

[Plano de sábado](docs/DIAGNOSTICO-DIA1.md#plano-para-sábado-1010): KZN-312 (serviço/centavos), KZN-318 (contrato de unidades), KZN-325 (URL/filtros/paginação), KZN-331 (enderecoId). Cada etapa registra arquivos, testes novos e riscos; não é necessário reiniciar a investigação.

Marcadores encontrados na leitura da base: KZN-2B9C (configuração), KZN-7F3A (carrinho), KZN-5D1E (cabeçalho). São referências de revisão presentes na origem, não chamados adicionais resolvidos.

Dia 2: quatro chamados corrigidos e verificados com testes novos de comportamento esperado e build. Evidências e comandos em [VALIDACAO-DIAS2-3.md](docs/VALIDACAO-DIAS2-3.md). Múltiplos carrinhos será a etapa seguinte. Implantação e auditoria independente ficam para o Dia 4.

Histórico da entrega parte de 69c4843; importação segura registrada em eb0f240. O fechamento Git será verificável pelo histórico da main e comparação local/remoto; detalhes locais de backup estão no diagnóstico. Nenhum push foi direcionado ao repositório da empresa.
