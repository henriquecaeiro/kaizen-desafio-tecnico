# Segunda-feira — pendências priorizadas

1. **Antes de publicar:** confirmar com responsável pelo SIAC rotação da credencial
   histórica (A01); nenhum segredo foi republicado. Corrigir CORS refletido (A07)
   e configurar proxy confiável, HTTPS, cookies secure e segredo de produção.
2. **Sessões e autenticação:** revogação após troca de senha/logout (A13), limite
   de tentativas por conta/IP (A19) e consistência de senha com espaços (A12).
3. **Integridade e contrato:** revisar endereço principal (A11), limpeza de telefone
   (A10), JSON inesperado do ERP nas leituras não tratadas (A16), stream de imagem
   (A22) e recuperação de erro na listagem/detalhe de pedidos (A21).
4. **Operação de checkout:** combinar processo de conferência de tentativas
   VALIDANDO/ENVIANDO interrompidas e INCERTO; verificar contrato real de
   idempotência/reconciliação do SIAC, sem criar pedidos involuntários. Não liberar
   bloqueios automaticamente. Atomicidade do estoque interno permanece não verificada.
5. **Implantação obrigatória no README:** escolher host com backend Node e volume
   persistente SQLite; build, migração com backup, monitoramento e restauração.
   Validar mesma origem, fallback SPA, proxy/imagens e reinício. Ainda não há URL
   pública da solução; publicar o código no GitHub não substitui hospedagem.
6. **Validação da entrega:** rodar suítes/build no ambiente de destino, testar
   migração com cópia de banco real e backup, outros navegadores e dispositivos,
   acessibilidade/contraste nas telas finais e logs sem dados sensíveis. Não foi
   feito teste de carga nem de navegador Safari/Firefox.
7. **Publicação:** preencher data/tempo se disponíveis, conferir RELATORIO e
   evidências, revisar pendências aceitas, comparar main local/remota, conferir URL
   implantada e instruções de execução. Entregar link até 13/10 às 15h Brasília;
   meta interna 12/10 à noite. Não enviar e-mails automaticamente.

Os IDs e evidências iniciais estão em DIAGNOSTICO-DIA1.md. A02/A03/A04/A05/A08/
A09/A14/A15/A17/A18 receberam tratamento relacionado aos Dias 2 e 3. A06 tem
proteção contra repetição insegura, mas a reconciliação entre sistemas continua
dependendo de operação e apoio do SIAC. A16 foi tratado na criação de pedido;
as demais leituras ainda precisam revisão.
