# Implantação e operação

## Estado em 11/10/2026

**Não há URL pública da solução.** Não foi identificado servidor autorizado,
domínio com acesso de publicação ou conexão de hospedagem disponível. O ambiente
não fornece credencial SIAC de produção. As opções de hospedagem encontradas
não estão conectadas; não foi contratado serviço, criado recurso pago ou usado
servidor pessoal/corporativo. A chave SSH disponível foi utilizada apenas para
publicar no GitHub de Henrique.

Preparação escolhida: Node em servidor Linux autorizado, Express servindo o build
Vite, disco persistente local, systemd e Caddy. Não exige container, ORM, serviço
de cache ou outra aplicação de frontend. Os comandos abaixo são procedimentos
para esse servidor, **não registro de um deploy realizado**.

## Pré-requisitos do responsável pela infraestrutura

- Autorizar um host e o acesso de publicação, sem contratar recursos nesta tarefa.
- Disponibilizar Node 24 LTS conforme `.nvmrc`, npm e Caddy 2. Configurar o caminho
  real do Node no service se diferente de `/usr/bin/node`.
- Disco persistente para `/var/lib/kaizen` e backups fora do diretório do código.
  Não usar filesystem efêmero, SQLite via NFS ou réplicas com bancos independentes.
- Domínio autorizado, DNS apontando para o host e portas públicas 80/443.
  Porta 3001 deve ficar somente em loopback, nunca aberta à internet.
- Saída HTTPS para o SIAC. Credencial fornecida pelo responsável; confirmar a
  rotação da credencial histórica potencialmente comprometida antes de publicar.
- Build tools caso better-sqlite3 precise compilar; não copiar node_modules
  de outro sistema operacional/versão de Node.

## Preparar código e configuração

Como usuário de publicação autorizado, obter **o repositório de Henrique** em
`/opt/kaizen/app` (ou adaptar WorkingDirectory). Em checkout existente, usar
`git fetch origin` e `git pull --ff-only`; não reinicializar nem apagar histórico.

```sh
cd /opt/kaizen/app/backend
npm ci
npm test
cd ../frontend
npm ci
npm test
npm run build
cd ../backend
node scripts/smoke-producao.mjs
node scripts/verificar-segredos.mjs
```

Testes/smoke usam ERP mock e banco temporário; não enviam pedidos ao SIAC.
Os testes de navegador exigem Chromium instalado e CHROMIUM_PATH correto.
O servidor de produção falha antes da migração se faltar dist/index.html.

Administrador do host: criar conta de serviço `kaizen` sem login interativo;
criar `/etc/kaizen` restrito e copiar `deploy/kaizen.env.example` para
`/etc/kaizen/loja.env`. Esse arquivo deve pertencer a root e ter modo 0600.
Preencher segredos **no servidor**, sem terminal compartilhado, logs ou Git.
Gerar JWT_SEGREDO criptograficamente (comando `npm run segredo:gerar`), não
reaproveitar segredo de teste. Manter DB_PATH fora do checkout.

| Variável | Produção |
|---|---|
| NODE_ENV | production |
| HOST / PORT | 127.0.0.1 / 3001 |
| DB_PATH | /var/lib/kaizen/ecommerce.db em disco persistente |
| JWT_SEGREDO / JWT_EXPIRACAO | Segredo aleatório privado / 7d |
| SIAC_URL / SIAC_TOKEN | Base HTTPS / credencial privada autorizada |
| CORS_ORIGEM | Origem HTTPS **exata** da loja, sem caminho ou barra final |
| TRUST_PROXY | loopback, somente para Caddy local; adaptar à topologia real |

Copiar `deploy/kaizen.service` para `/etc/systemd/system/kaizen.service`.
StateDirectory cria diretório de dados restrito e gravável pelo serviço.
Código fica somente leitura no serviço; UMask protege SQLite/WAL/SHM.
Não colocar segredos em ExecStart, pacote de release ou build React.

```sh
sudo systemd-analyze verify /etc/systemd/system/kaizen.service
sudo systemctl daemon-reload
sudo systemctl enable --now kaizen
sudo systemctl status kaizen
sudo journalctl -u kaizen --since '10 minutes ago'
```

Substituir `loja.example.invalid` em deploy/Caddyfile pelo domínio real, copiar
para `/etc/caddy/Caddyfile`, validar e recarregar Caddy conforme o serviço
instalado. O exemplo remove URI/headers dos logs do proxy. Backend registra
método, template de rota, status, duração e request-id, sem query/cookie/corpo.

```sh
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

Caddy configura certificados/renovação e redirecionamento HTTPS quando DNS,
portas e armazenamento atendem aos requisitos da
[documentação oficial](https://caddyserver.com/docs/automatic-https).
Proxy e filtragem de logs seguem as referências de
[reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) e
[log](https://caddyserver.com/docs/caddyfile/directives/log).
Não utilizar o endereço de exemplo como URL de entrega.

## Migrações, atualização e backup

O bootstrap aplica migrações 001–005 antes de aceitar requisições, em transação
IMMEDIATE. Banco novo e v0/v1/v2 são suportados; user_version impede reaplicar.
Não usar db:reset. Migração 003 invalida JWTs anteriores sem registro de sessão:
usuários existentes precisam entrar novamente, mas contas/carrinhos permanecem.

Criar backups com a API online do SQLite, que inclui dados confirmados no WAL.
**Não copiar somente ecommerce.db com o servidor rodando.**

```sh
sudo install -d -o kaizen -g kaizen -m 0700 /var/backups/kaizen
sudo -u kaizen /usr/bin/node /opt/kaizen/app/backend/scripts/backup-db.mjs \
  /var/lib/kaizen/ecommerce.db /var/backups/kaizen/ecommerce-pre-atualizacao.db
```

Usar nome novo em cada execução (por exemplo com data/hora). O script recusa
origem inexistente, destino existente ou igual à origem; cria arquivo 0600,
verifica integrity_check/foreign_key_check e só publica cópia completa.
Definir retenção, cópia externa criptografada e monitoramento de espaço com o
responsável. Nenhum banco/backup deve ir para GitHub ou hospedagem estática.

Atualizar: preparar/testar build, fazer backup, colocar loja em manutenção,
parar serviço, atualizar código/dependências, iniciar e conferir health/rotas.
Durante SIGTERM, o backend aguarda requisições até 10 segundos. Fechamentos
interrompidos continuam bloqueados: conferir tentativas após cada manutenção.

Para restaurar: parar serviço; preservar banco atual e seus WAL/SHM; copiar
backup verificado para **novo caminho**, nunca sobrescrever o banco existente.
Manter dono kaizen/permissão 0600; alterar DB_PATH em /etc/kaizen/loja.env;
reiniciar e validar dados. Confirmar versão do código compatível com user_version.
Não fazer downgrade de banco migrado usando código antigo.

Restauração pode perder vínculos/tentativas posteriores ao backup, enquanto
pedidos no SIAC continuam existindo. **Conferência de pedidos é obrigatória antes
de reabrir checkout**, para não reenviar compras aceitas pelo ERP.

## Tentativas interrompidas/incertas

VALIDANDO/ENVIANDO que ficaram após queda e INCERTO exigem conferência pela loja.
Não há TTL que libere o carrinho nem retry automático. Inspecionar id, estado,
carrinho, datas e numero_erp em checkout_tentativas, com acesso restrito ao banco.
Se há número conhecido, conferir o pedido no SIAC e o vínculo local. Se não há,
solicitar ao responsável a identificação da operação. Registrar a decisão antes
de qualquer reparo local; não fornecer UPDATE indiscriminado para liberar tudo.
Sem confirmação externa, manter bloqueio. Interface administrativa e idempotência
por chave no ERP permanecem melhorias futuras, não garantias desta entrega.

## Validar o host real antes de declarar implantação concluída

Validar URL HTTPS, certificado/redirecionamento, HTML/assets, refresh /checkout,
health, catálogo/categorias/imagens, busca/filtros/página, cadastro/login, cookies
Secure/HttpOnly/Lax, rotas protegidas e origens rejeitadas. Criar duas contas
fictícias, gerir carrinhos, trocar seleção, conferir isolamento e reiniciar
serviço mantendo itens/seleção/sessão. Verificar quatro larguras e logs.

GET /api/health informa status local e erp separadamente: ERP indisponível não
deve levar o supervisor a reiniciar o processo indefinidamente. Monitorar também
erp, erros 5xx, espaço em disco e tentativas bloqueadas. Não concluir pedidos
reais de teste sem autorização específica. Só então registrar URL no README,
RELATORIO e e-mail. Essas verificações públicas continuam pendentes.

## Antes do envio

A revisão do código não resolveu a dependência de infraestrutura: ainda faltam
host/acesso autorizado, domínio/DNS/HTTPS, disco persistente e credencial SIAC
de produção com rotação da chave histórica confirmada. A loja precisa acordar
a conferência de tentativas incertas/interrompidas e a rotina de backup externo.
Nenhum recurso pago foi contratado ou servidor público configurado nesta revisão.

Após validar o destino, registrar a URL real no README, relatório e
[e-mail de entrega](EMAIL-ENTREGA.md). Envio manual após revisão; nenhum e-mail
foi enviado. Meta interna: 12/10/2026 à noite. Prazo oficial: 13/10/2026 às 15h Brasília.
