# Validação dos Dias 2 e 3

## Dia 2

Workspace Linux: `/home/henrique/DEV/kaizen-desafio-tecnico`, Node 20.19.2,
Chromium do sistema. Instalações por `npm ci`; better-sqlite3 compilado localmente.
O ambiente difere do Windows registrado no Dia 1. Nenhum banco existente foi resetado.

| Etapa | Comando / resultado |
|---|---|
| KZN-312 | backend `npm test`: 15/15; frontend `npm run build`: aprovado |
| KZN-318 | backend `npm test`: 16/16; frontend `npm test`: 4/4; build aprovado |
| KZN-325 | frontend `node --test tests/catalogo.test.mjs`: 5/5; build aprovado |
| KZN-331 | backend `npm test`: 23/23; frontend suíte: 11/11, mais teste novo de endereço criado: arquivo checkout 3/3; build aprovado |

Testes afirmam o comportamento corrigido. O script do Dia 1 não foi executado
como regressão. ERP mock HTTP e SQLite temporário; fetch dos testes limitado a
loopback. Navegador abre o código modificado pelo Vite, com proxy para esse backend.
Reproduções esperadas de falhas (503/409/422) aparecem nos logs de teste.

Falhas durante desenvolvimento: primeira execução antecipou a compilação nativa;
seletor ambíguo de CEP no teste e espera imediata do checkbox foram corrigidos.
Essas execuções não foram contadas como validação aprovada.

As branches são publicadas no repositório de Henrique. HTTPS sem credencial
falhou; push passou usando a chave SSH já existente, sem exibir credenciais.

## Dia 3

Em implementação. Resultados finais serão registrados após execução da suíte.
