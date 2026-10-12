# Implantação e operação

## Estado em 12/10/2026

**Publicação ainda pendente.** A topologia solicitada é Netlify (frontend HTTPS)
e ngrok (backend Node/SQLite no Kali). A configuração está preparada, mas ainda
faltam autenticar ngrok, confirmar autorização/rotação SIAC, liberar a porta
3001 ocupada pelo processo root e obter a URL real do Netlify. Nenhum domínio
público foi inventado. Nenhum recurso pago foi contratado.

Os exemplos systemd/Caddy em deploy/ permanecem como alternativa de hospedagem
permanente, não como registro de um deploy realizado.

## Netlify e ngrok no Kali

Fluxo: navegador HTTPS → Netlify `/api/*` → ngrok HTTPS → Node em
127.0.0.1:3001 → SQLite persistente/SIAC. O frontend mantém `/api` e
credentials: include. SIAC_TOKEN/JWT_SEGREDO nunca entram no build ou no Netlify.

### Preparação realizada

- netlify.toml na raiz: base frontend, npm run build e publish dist (relativo à
  base, portanto frontend/dist). Node 24.21.0; instalação automática via lockfile.
- Hook local frontend/netlify, sem novas dependências: exige NGROK_URL HTTPS,
  insere proxy `/api/*` antes da regra SPA, status 200/force e header
  ngrok-skip-browser-warning: 1. A URL não é hardcoded no React. Sem ela, o deploy
  falha antes do build. Domínios fictícios existem somente nas fixtures de teste.
- Cookie original host-only (sem Domain), HttpOnly/Secure/SameSite=Lax/Path=/;
  cache da API private, no-store, inclusive erros/autenticação. Imagens públicas
  conservam sua política própria. CSP e nosniff também configurados no frontend.
- ngrok oficial 3.39.11 em /home/henrique/.local/bin/ngrok. Autenticação pendente.
  Janela xterm de autenticação aberta como henrique; isso **não é túnel ativo**.
- Configuração privada backend/.local/netlify-ngrok.env criada, ignorada pelo Git,
  modo 0600. .env original e seu banco/WAL não foram sobrescritos.
- Banco novo /home/henrique/.local/share/kaizen-netlify/ecommerce.db, arquivo 0600
  em diretório 0700, migração 5 e integrity_check ok. Não é banco descartável.
  O bootstrap de produção ainda exige o build local frontend/dist, preservado.

### Ações locais restantes

1. Confirmar que a credencial SIAC é autorizada para exposição pública; se for a
   histórica potencialmente comprometida, rotacioná-la no canal apropriado e
   atualizar backend/.env localmente. Não publicar antes disso.
2. Conferir o processo que ocupa 3001. Durante a preparação era root PID 8053,
   node src/server.js. O responsável deve pará-lo no terminal original (Ctrl+C)
   ou usar sudo kill -TERM somente após confirmar o PID. Não encerrar processo
   desconhecido e não iniciar a nova loja como root.
3. Autenticar o ngrok no terminal de entrada oculta aberto. Alternativa em zsh:

   ```sh
   read -rs 'kaizen_ngrok_token?Authtoken ngrok: '
   print
   /home/henrique/.local/bin/ngrok config add-authtoken "$kaizen_ngrok_token"
   unset kaizen_ngrok_token
   ```

   O valor não vai para o histórico; é gravado na configuração privada do ngrok.
   Não colar token em chat, script, Git, URL ou logs. Restringir o arquivo gerado
   com chmod 600 /home/henrique/.config/ngrok/ngrok.yml.
4. Com a credencial aprovada e porta livre, abrir terminal gráfico normal e manter
   ngrok em primeiro plano (não usar nohup nem background):

   ```sh
   /home/henrique/.local/bin/ngrok http http://127.0.0.1:3001 --inspect=false
   ```

   --inspect=false evita que o inspector local armazene corpos/cookies/senhas de
   autenticação. A interface do terminal continua mostrando estado/URL. A URL
   HTTPS real pode ser consultada sem dados de sessão em localhost:4040/api/tunnels.
   Sem backend iniciado, o túnel retorna erro de upstream; não é loja pronta.
5. Criar o site no Netlify importando o repositório de Henrique, branch main.
   Usar netlify.toml; não criar _redirects conflitante. Antes do deploy, definir
   NGROK_URL (escopo Builds) com a origem HTTPS REAL exibida pelo ngrok, sem /api.
   Essa URL é pública, não é segredo. Sem ela o build será bloqueado de propósito.
   Não adicionar SIAC_TOKEN, JWT_SEGREDO ou token ngrok ao ambiente Netlify.
6. Obter a origem HTTPS final do site e preencher CORS_ORIGEM no arquivo privado
   backend/.local/netlify-ngrok.env. Não usar wildcard nem origem fictícia. O
   arquivo mantém NODE_ENV=production, HOST=127.0.0.1, PORT=3001, TRUST_PROXY=loopback
   e DB_PATH separado. Somente o agente local é confiável; não confiar em toda
   internet/Netlify por quantidade de saltos, nem utilizar TRUST_PROXY=true.
7. Em outro terminal normal, com frontend/dist atualizado:

   ```sh
   cd /home/henrique/DEV/kaizen-desafio-tecnico/backend
   umask 077
   node --env-file=.local/netlify-ngrok.env src/server.js
   ```

   Variáveis explícitas desse arquivo prevalecem; dotenv carrega os segredos do
   .env original. Não copiar dependências nativas entre Node 20 e 24; usar npm ci
   com o runtime escolhido se mudar o Node. Manter ambos terminais abertos e o
   Kali ligado/conectado. Alterar CORS_ORIGEM exige reiniciar este backend.
8. Conferir health/catalogo/categorias pelo HTTPS do ngrok usando o header
   ngrok-skip-browser-warning: 1 e depois pela origem Netlify. Registrar URLs reais
   e executar o checklist público abaixo antes de declarar publicação concluída.
   Se a URL ngrok mudar, atualizar NGROK_URL e fazer novo deploy no Netlify.

Build oficial local da CLI Netlify validou os caminhos e a inserção do proxy com
fixture fictícia, em modo offline; também confirmou bloqueio sem NGROK_URL.
Isso **não comprova** rede pública/cookies no CDN. Métodos, query strings, JSON,
cookies e erros devem ser conferidos no destino real, sem pedidos de teste SIAC.

### Checklist pelo domínio real do Netlify (pendente)

Health, catálogo/categorias/produto e JSON (não HTML intermediário); cadastro/login,
cookie Secure/HttpOnly/Lax, logout/relogin; perfil PATCH, endereços POST/PUT/DELETE;
dois carrinhos, ativação PUT, quantidade PATCH, exclusão DELETE, F5 com sessão e
itens persistidos, duas contas isoladas; refresh direto de perfil/carrinho/checkout,
mobile/Console/Network. Conferir endereço no checkout sem finalizar pedido real.
Verificar query strings, X-Carrinho-Id, corpos JSON e respostas 401/404/409/502.
Não considerar localhost ou build offline equivalentes a essa validação.

Referências oficiais: [proxy e headers](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/),
[caminhos do monorepositório](https://docs.netlify.com/build/configure-builds/monorepos/),
[hooks locais](https://docs.netlify.com/extend/develop-and-share/develop-build-plugins/) e
[instalação ngrok](https://ngrok.com/download/linux?tab=download).

## Alternativa permanente: systemd e Caddy

Node em servidor Linux autorizado, Express servindo o build Vite, disco persistente
local, systemd e Caddy. Os procedimentos seguintes são preservados como alternativa.

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

A revisão do código não resolve a dependência de autenticação/origens/autorização:
para Netlify/ngrok, cumprir as ações pendentes acima; para systemd/Caddy, obter
host/acesso, domínio/DNS/HTTPS e credencial SIAC autorizada. A loja precisa acordar
a conferência de tentativas incertas/interrompidas e a rotina de backup externo.
Nenhum recurso pago foi contratado ou servidor público configurado nesta revisão.

Após validar o destino, registrar a URL real no README e relatório antes do
envio da entrega. Nenhum e-mail foi enviado. Prazo oficial: 13/10/2026 às 15h Brasília.
