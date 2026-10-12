# Implantação e operação

## Estado da publicação manual — 12/10/2026

Site existente: https://desafio-kaizen.netlify.app
Backend ativo: https://2154-2804-d59-a107-c600-b57-957-65d4-af7d.ngrok-free.app
Backend local: http://127.0.0.1:3001, production, usuário henrique.

O site já contém um frontend, mas sua API devolvia 404 HTML do Netlify. O upload
manual anterior não incluía as regras geradas pelo plugin de build remoto.
A solução atual usa somente arquivos estáticos copiados pelo Vite para dist.
**A validação pública da nova versão depende do upload; não foi considerada aprovada.**

## Gerar e publicar no site existente

```sh
cd /home/henrique/DEV/kaizen-desafio-tecnico/frontend
npm ci
npm run build
```

O diretório pronto para upload é frontend/dist. Contém index.html, assets/,
_redirects e _headers. Arrastar **a pasta dist completa** para a área de deploy
manual da aba Deploys do projeto existente desafio-kaizen, no painel Netlify.
Não usar a página de criação de outro site; não enviar somente index.html ou a
pasta frontend inteira. O domínio deve continuar desafio-kaizen.netlify.app.

Nenhum plugin, variável NGROK_URL ou build remoto é necessário. netlify.toml
mantém apenas base frontend, npm run build, publish dist e versão do Node para
quem optar por build Git. As regras têm uma única fonte: frontend/public.

Conteúdo de public/_redirects (copiado sem alterações para dist):

```text
/api/* https://2154-2804-d59-a107-c600-b57-957-65d4-af7d.ngrok-free.app/api/:splat 200!
/* /index.html 200
```

200! força proxy, não redireciona o navegador; o fallback SPA vem por último.
public/_headers conserva CSP, nosniff e Referrer-Policy para arquivos estáticos.
_headers configura **respostas**, não cabeçalhos enviados ao ngrok.

## Aviso ngrok e autenticação

Fetch da API permanece relativo a /api, com credentials: include, e envia
ngrok-skip-browser-warning: 1 (não sensível). A CLI oficial comprovou seu
encaminhamento: com User-Agent de navegador, ngrok devolveu HTML sem esse header
e JSON com ele. HTTP 200 com HTML/JSON inválido agora produz RESPOSTA_INVALIDA,
sem transformar erro em sucesso. Erros HTTP conservam status e código.

Imagens /api/imagens também recebem o aviso se usadas diretamente em img.
ImagemProduto faz fetch com o mesmo header e mostra data URL; img-src data:
já era permitido pela CSP. Catálogo, detalhe e carrinho usam o componente.
Requisições pendentes são abortadas ao desmontar e HTML não é exibido como imagem.
Não houve mudança de layout, cookie, regra financeira, checkout ou CORS permissivo.

Cookies host-only HttpOnly/Secure/SameSite=Lax/Path=/ continuam sendo enviados
pela mesma origem Netlify. Não há JWT em localStorage nem credencial no build.
A API mantém private, no-store; imagens públicas conservam sua política própria.
O encaminhamento público de sessão ainda deve ser conferido depois do upload.

## Backend privado e serviços mantidos

backend/.local/netlify-ngrok.env continua ignorado pelo Git e restrito (0600).
Somente CORS_ORIGEM foi corrigido para https://desafio-kaizen.netlify.app.
NODE_ENV=production, HOST=127.0.0.1, PORT=3001, TRUST_PROXY=loopback e
DB_PATH=/home/henrique/.local/share/kaizen-netlify/ecommerce.db preservados.

A origem anterior foi rejeitada por 403 quando o navegador enviou a nova origem.
Foi necessário um único reinício controlado do Node, previamente anunciado, após
consulta somente de leitura confirmar zero checkouts em andamento. O Node foi
iniciado como henrique em terminal gráfico permanente. O ngrok não foi reiniciado
nem substituído. Segredos, banco existente, sessões e arquivos de infraestrutura
não foram resetados. Nenhum pedido real foi enviado.

Health local e ngrok: JSON/200, production, ERP ok. Preflight da origem real: 204
com credenciais/origem exata; health com Origin real: 200. Não há necessidade de
novo reinício por causa do upload de dist. Manter Kali, Node e ngrok ativos.
Se o domínio ngrok mudar, atualizar public/_redirects, gerar dist e reenviar.

## Validação realizada e comandos opcionais

Suítes completas backend/frontend, build, smoke de produção e scanner são os
comandos existentes em README/VALIDACAO-FINAL. A CLI Netlify foi usada apenas como
ferramenta de verificação, instalada fora do repositório; não é dependência do build.

Smoke opcional do proxy com banco descartável e ERP mock:

```sh
cd backend
NETLIFY_CLI=/caminho/da/cli/netlify-cli/bin/run.js \
NETLIFY_CLI_NODE=/caminho/do/node-compativel \
node scripts/smoke-netlify-proxy.mjs
```

O script copia dist para /tmp e altera somente o alvo dessa cópia para o backend
mock. Não altera dist real, SQLite privado ou serviços ativos. Exercita
GET/POST/PATCH/PUT/DELETE, query/JSON, X-Carrinho-Id, cookies, sessão, perfil,
endereços, carrinhos, isolamento e erros 401/404/409/502, com zero pedidos.

Na CLI apontando para o ngrok real: health/catálogo/categorias JSON, erros 401/404
JSON, assets e refresh de entrar/cadastro/perfil/carrinho HTTP 200; Chromium
conferiu catálogo/imagens/JavaScript e 360/390/768/1440 px. Somente leituras reais.

A primeira tentativa da CLI falhou por ENOSPC. O cache descartável da CLI criado
nesta tarefa foi movido para /tmp, preservando seu caminho via symlink e liberando
305 MB. Arquivos pessoais e banco não foram apagados. O disco continua com pouco
espaço; providenciar manutenção antes de uso prolongado.

## Conferência após seu upload (pendente)

Abrir https://desafio-kaizen.netlify.app/api/health e conferir JSON/200 com o header
de bypass; uma navegação direta de navegador sem header pode receber aviso ngrok.
Na loja, verificar catálogo/imagens, login/cadastro, dois carrinhos, quantidades,
F5 mantendo sessão/itens, perfil/endereço e logout/relogin. Usar Console/Network,
mobile e checkout sem finalizar pedido real. API não pode devolver index.html,
nem redirecionar o navegador ao ngrok. O antigo 404 somente desaparece no domínio
público após publicar este novo dist.

Referências oficiais: [proxy Netlify](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/),
[headers estáticos](https://docs.netlify.com/manage/routing/headers/),
[public do Vite](https://vite.dev/guide/assets.html#the-public-directory) e
[bypass ngrok](https://ngrok.com/docs/pricing-limits/free-plan-limits#using-headers).

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
Nenhum recurso pago foi contratado. Backend existente recebeu a correção necessária
de origem; frontend novo ainda deve ser enviado manualmente ao site existente.

Após validar o destino, registrar a URL real no README e relatório antes do
envio da entrega. Nenhum e-mail foi enviado. Prazo oficial: 13/10/2026 às 15h Brasília.
