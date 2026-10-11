# Pendências de entrega — revisão em 11/10/2026

A auditoria final foi executada antecipadamente. Os resultados históricos dos
Dias 2/3 permanecem em VALIDACAO-DIAS2-3.md; resultados atuais em VALIDACAO-FINAL.md.

## Prioridades restantes

1. **Bloqueante para entrega integral — implantação pública.** Identificar host
   autorizado, acesso de publicação, disco persistente, domínio/DNS/HTTPS e
   credencial SIAC de produção. Nenhum recurso pago foi criado. Código no GitHub
   não substitui deploy. Preparação, comandos e checklist em IMPLANTACAO.md.
2. **Responsável pelo SIAC — rotação da credencial histórica A01.** Permanece
   potencialmente comprometida. Remover de uma cópia não revoga no ERP; não
   houve autorização para rotação. Confirmar ação antes de disponibilizar a loja.
3. **Operação de checkout A06.** Acordar conferência de VALIDANDO/ENVIANDO após
   interrupção e INCERTO. Não liberar por TTL nem reenviar automaticamente. Falta
   suporte confirmado do SIAC para idempotência/reconciliação; atomicidade interna
   do estoque não foi demonstrada por mocks.
4. **Validação no destino.** Executar testes/build no host, validar URL real,
   certificado/cookies, saída para ERP, reinício, persistência, logs, backup externo
   e restauração. Banco com dados reais não foi utilizado nesta tarefa.
5. **Complementos não bloqueantes de teste.** Safari/Firefox, dispositivos reais,
   leitor de tela e carga não foram executados. A verificação automatizada de
   contraste não é certificação WCAG completa. Rate limit não substitui proteção
   de borda e pode afetar NAT ou conta alvo de bloqueio temporário.
6. **Envio e devolutiva.** Revisar EMAIL-ENTREGA.md, atualizar status/URL somente
   após deploy validado e enviar manualmente aos destinatários. Nenhum e-mail foi
   enviado. Preparação técnica está em ENTREVISTA-FINAL.md. Prazo oficial:
   13/10/2026 às 15h Brasília; meta interna 12/10 à noite.

## Concluído na auditoria

A07: origem explícita/CORS e proxies. A10: limpeza parcial de telefone.
A11: endereço principal, reparo legado e índice. A12: senha sem trim.
A13: revogação persistida e proteção de cookie contra respostas antigas.
A16: contratos ERP nas leituras/health/imagens. A19: limite por conta/IP.
A21: recuperação de pedidos e aviso de status indisponível. A22: stream/logs.
Revisão adicional: labels, áreas de clique, contraste do perfil, produto mobile,
atalho de foco, build obrigatório em produção e backup consistente com WAL.

A02/A03/A04/A05/A08/A09/A14/A15/A17/A18/A20 já estavam tratados nos Dias 2/3 e
continuam cobertos pela regressão. A01 e a fronteira transacional de A06 não
podem ser considerados resolvidos exclusivamente no código desta loja.
