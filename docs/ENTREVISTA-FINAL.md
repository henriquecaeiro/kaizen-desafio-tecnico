# Devolutiva técnica — versão final

1. **Quatro causas:** KZN-312 somava linhas pendentes; KZN-318 contava linhas
   como unidades; KZN-325 preservava página ao mudar critérios; KZN-331 ignorava
   o radio selecionado e buscava o principal novamente. Totais/contagem foram
   corrigidos no serviço; URL/endereço na camada que construía a requisição.
2. **Dinheiro:** preço vira centavos uma vez, com arredondamento central, antes
   de multiplicar/somar. valor_itens mostra linhas conhecidas; valor_total é o
   elegível. Linha indisponível inteira sai do elegível, permanece visível e
   bloqueia checkout. Sem apagar produto ou reduzir quantidade silenciosamente.
3. **Modelagem:** carrinhos pertencem a usuários; itens referenciam carrinho.
   Índice parcial permite um ativo por conta, seleção persistida e limite de dez.
   Serviço garante padrão no acesso e após excluir o último. Preços/estoque não
   ficam no SQLite; continuam vindo do SIAC.
4. **Migração:** schema v0 e migrações 001–005 com user_version, transação
   IMMEDIATE e foreign_key_check. Primeira transfere os itens para padrões;
   segunda cria tentativas; terceira/quarta sessões/limites; quinta normaliza
   principal e cria índice. Nenhum reset. Datas/conteúdo dos endereços são
   preservados; flags inválidas de principal são reparadas explicitamente.
5. **Isolamento:** usuário vem da sessão, nunca do body. SQL parametrizado e
   propriedade em cada serviço; IDs alheios recebem 404. X-Carrinho-Id opcional
   protege ação de aba antiga; contexto descarta resposta de outra sessão ou
   seleção. Frontend não é a autorização.
6. **Sessões:** JWT HS256 em cookie HttpOnly/Lax/Secure em produção, com jti em
   sessoes. Logout revoga só aquele registro; senha revoga todas as anteriores
   e renova o cookie atual. Login revalida hash após scrypt; troca compara hash
   na gravação. Resposta 401 antiga não apaga cookie novo. Requisição já
   autorizada não é cancelada. Senha conserva espaços e normalização NFKC antiga.
7. **CORS/proxy:** origens exatas do ambiente, HTTPS em produção; outra origem
   recebe 403 sem liberação CORS. Sem Origin continua permitido. Mesma origem
   permanece o uso normal. Proxy é desabilitado por padrão; só confiar nos
   proxies reais, não em X-Forwarded-For enviado por qualquer cliente.
8. **Concorrência:** reserva persistida e índice por carrinho antes do HTTP.
   Sem transação aberta esperando ERP. Mutações/exclusão bloqueadas naquele
   carrinho; outro pode ser usado. Após aceite, vínculo/snapshot/limpeza e
   conclusão são uma transação. UUID concluído retorna pedido existente.
9. **Última peça:** a loja reconsulta estoque, mas dois clientes podem ler uma
   mesma unidade disponível. O SIAC precisa validar/reservar no POST; recusa
   409 preserva itens e permite ajuste. Mock não prova atomicidade do ERP, nem
   estoque atualizado em tempo real (enunciado informa atualização periódica).
10. **Aceite sem resposta:** timeout/5xx/contrato inválido ou falha local depois
    do aceite deixam INCERTO, itens/bloqueio preservados e número quando conhecido.
    Queda em VALIDANDO/ENVIANDO também mantém bloqueio após reinício. Não existe
    TTL liberador, reenvio automático ou exactly-once prometido. Conferência
    operacional é necessária sem idempotência/reconciliação oferecida pelo SIAC.
11. **Produção:** preparação Node/systemd/Caddy, build servido pelo Express,
    SQLite fora do checkout, configuração privada e backup online com WAL.
    Configurações e produção local/reinício foram testados, inclusive no Node
    24.21.0 com instalação limpa. **Não houve implantação pública:** depende de
    host/domínio/acesso/credencial autorizados. Não apresentar exemplo como URL.
12. **Limites:** rotação SIAC externa, reconciliação administrativa, implantação
    e testes no destino, outros navegadores/carga/leitor de tela. Rate limit
    persistido é proteção pragmática, não solução de DDoS; NAT/contas alvo podem
    ser afetados. Backup restaurado exige conferir pedidos posteriores no SIAC.

## Cinco decisões a defender

Regra de carrinho no backend; dados locais mínimos sem cópia do catálogo;
migração transacional sem ORM/reset; sessões e reservas persistidas no SQLite;
tratamento conservador de resultado incerto, sem falsa promessa entre sistemas.

Para revisar pessoalmente antes da conversa:

1. `backend/src/services/carrinhoService.js` e `lib/dinheiro.js`: linhas, unidades, centavos e total elegível.
2. `backend/src/db/index.js` e migrações: preservação de dados, índices, rollback e versões.
3. `backend/src/services/pedidoService.js` e `checkoutTentativaService.js`: reserva, aceite remoto e resultado incerto.
4. `backend/src/services/sessaoService.js` e `middleware/limiteAutenticacao.js`: revogação, corridas de senha e limites.
5. Contextos de `frontend/src/contextos/` e `paginas/Catalogo.jsx`: identidade, respostas fora de ordem, retry e filtros na URL.

## Três riscos principais

Implantação pública ainda bloqueada; credencial histórica depende de rotação
externa; resultado/estoque entre loja e SIAC depende de conferência e garantias
do ERP, não só dos testes locais.

## Perguntas prováveis

- Por que não somar total no React? Por que excluir a linha pendente inteira?
- O índice garante exatamente um ativo ou somente no máximo um? Quem garante o padrão?
- Como migrar sem perder itens e reverter erro sem reset?
- Por que JWT também consulta SQLite? O que acontece com cookie roubado após logout?
- Como impedir duplicação sem uma transação distribuída? Por que não expirar o bloqueio?
- Como publicar SQLite sem perder dados? O que precisa conferir após restaurar backup?
- Qual verificação foi realmente executada e qual ainda depende de infraestrutura?
