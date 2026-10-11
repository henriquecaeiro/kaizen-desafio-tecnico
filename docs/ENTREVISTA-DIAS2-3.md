# Decisões para a devolutiva

1. **KZN-312:** o serviço somava todas as linhas, mesmo quando sem estoque.
   Corrigi o backend porque todos os consumidores precisam da mesma regra.
   Total elegível exclui a linha pendente inteira; ela segue visível e bloqueia
   checkout. Valor das linhas fica separado. Preço vira centavos arredondados no
   utilitário central; multiplicação e soma usam inteiros.
2. **KZN-318:** contava linhas como peças. Produtos distintos continuam em
   quantidade_itens; quantidade_pecas soma unidades, inclusive pendentes. O
   contexto também passou a acompanhar sessão e a descartar respostas antigas,
   inclusive a consulta inicial de autenticação terminando depois de um login.
3. **KZN-325:** mudar busca/filtro mantinha a página anterior. Agora critérios
   removem pagina da URL; paginar conserva critérios. O campo acompanha a URL.
   Próxima estava comparando com última página menos um; comparação corrigida
   também atende Pedidos.
4. **KZN-331:** o radio mudava enderecoId, mas a requisição buscava o principal
   novamente. Envio a seleção; principal só inicializa. Backend já validava posse
   e snapshot, então mantive essas regras.
5. **Modelagem:** carrinhos pertencem a usuários e itens pertencem a carrinhos.
   Índice único parcial garante no máximo um ativo por conta. A seleção é
   persistente; serviço garante padrão no primeiro acesso ou após última exclusão.
   Excluir ativo promove o mais antigo. Limite 10 é verificado em transação curta.
6. **Migração:** v0 é a estrutura antiga. Migração 001 cria padrões e transfere
   itens, sem mudar contas, endereços ou vínculos. Contagens e foreign_key_check
   detectam perda/inconsistência; user_version impede repetir. Tudo é transacional.
   Migração 002 acrescenta tentativas. Não usei ORM ou reset de banco.
7. **Isolamento:** serviços exigem usuário autenticado e verificam dono de cada
   carrinho. IDs alheios recebem 404. Header opcional X-Carrinho-Id evita aplicar
   uma ação de aba antiga ao novo ativo. Segurança não depende do React.
8. **Checkout:** captura carrinho antes do HTTP e reserva tentativa no SQLite.
   Bloqueia mutações de itens e exclusão nele; outros podem ser usados. Após aceite, grava vínculo,
   snapshot, limpeza daquele carrinho e conclusão juntos. Recusa preserva itens.
9. **Concorrência e estoque:** índice de tentativa impede dois fechamentos do
   mesmo carrinho, inclusive em outra conexão. UUID concluído retorna o pedido
   existente. Estoque é consultado antes e o SIAC pode recusar no POST. Sem apoio
   do SIAC não afirmo atomicidade de estoque ou exactly-once; timeout/5xx podem
   esconder aceite. Estado incerto bloqueia repetição até conferência; também
   preservo bloqueios após queda de processo. Não deixo transação aberta em HTTP.
10. **Interface e evolução:** componentes do carrinho são compartilhados entre
    página e painel; URL não muda ao gerenciar. Desktop mantém vitrine utilizável,
    mobile usa dialog com foco, Escape e retorno ao acionador. Com mais tempo:
    reconciliação administrativa apoiada pelo SIAC, auditoria de sessão/CORS,
    testes em outros navegadores, implantação HTTPS e backup/restauração.
