# Vagari Experience

Companheiro digital de viagem da Vagari: a equipe organiza e atualiza as informações; o viajante recebe tudo em um só lugar.

> **Estado atual:** backend completo (41 testes) + **app do viajante para iOS/Android** (Expo/React Native) + **painel da equipe** (React), com todas as telas no design system Vagari. App e painel rodam em modo demonstração com dados fictícios até serem ligados ao servidor.

- Arquitetura, banco, permissões e fluxos: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)
- Publicação nas lojas e o que falta: [`docs/APP-LOJAS.md`](docs/APP-LOJAS.md)
- Fotos dos destinos (lista e licenças): [`docs/FOTOS.md`](docs/FOTOS.md)
- Guia de preenchimento das planilhas: [`docs/IMPORTACAO.md`](docs/IMPORTACAO.md) · modelos em [`templates/`](templates/)
- Biblioteca inicial de destinos (pendente de revisão): [`content/biblioteca-inicial.xlsx`](content/biblioteca-inicial.xlsx)

## Estrutura

```
server/        API (Node + Express + SQLite) — importação, permissões, histórico
apps/mobile/   App do viajante — Expo / React Native (iOS e Android)
apps/admin/    Painel da equipe — React + Vite (servido em /painel)
shared/        Design system (tokens, ícones Lucevias), biblioteca de destinos e dados de demonstração
scripts/       Geração de modelos, ícones, biblioteca e da prévia
```

## Rodando

Precisa de Node 22+.

```bash
npm install
cp .env.example .env          # defina ADMIN_EMAILS com o seu e-mail
npm start                     # http://localhost:3000
npm test                      # 41 testes
```

Ambiente de demonstração, com dados **fictícios** e banco separado:

```bash
DEMO_MODE=1 DATABASE_PATH=data/demo.db ADMIN_EMAILS=voce@vagari.com.br npm run seed:demo
DEMO_MODE=1 DATABASE_PATH=data/demo.db ADMIN_EMAILS=voce@vagari.com.br npm start
```

O seed se recusa a rodar sem `DEMO_MODE=1` ou num banco com viagens reais. Sem SMTP configurado, os códigos de acesso aparecem no log.

`npm run templates` regenera os modelos em `templates/`.

### App do viajante (Expo)

```bash
cd apps/mobile && npm install
npx expo start            # abre no celular com o Expo Go (QR code) ou no simulador
```

Sem configuração ele roda em **modo demonstração**. Para falar com o servidor: `EXPO_PUBLIC_API_URL=https://api.vagari.com.br npx expo start`.

### Painel da equipe

```bash
npm --prefix apps/admin install
npm --prefix apps/admin run dev        # http://localhost:5173 (usa a API em localhost:3000)
npm run build:admin                    # gera apps/admin/dist, servido pelo servidor em /painel
```

### Prévia navegável (app + painel + design system)

`npm run preview:build` gera a pasta `preview/` (app exportado para web, painel com dados fictícios e a vitrine).

## API (resumo)

Todas as respostas são JSON em português. Erros de validação voltam com `issues: [{ column, message, hint }]`.

**Acesso** — `POST /api/auth/request-code` · `POST /api/auth/verify-code` · `GET /api/auth/invite/:token` · `POST /api/auth/invite/:token/accept` · `POST /api/auth/logout`

**Viajante** — `GET/PATCH /api/me` · `GET /api/me/export` · `POST /api/me/privacy-requests` · `GET /api/trips` · `GET /api/trips/:id` (início) · `/itinerary` · `/tasks` (+ `POST|DELETE /tasks/:taskId/complete`) · `/documents` (+ `/:docId/file`, `POST /:docId/link`) · `/guide?q&category&destination_id&favorites=1&near=hotel` · `/help` · `GET /api/places/:id` · `POST|DELETE /api/places/:id/favorite` · `GET /api/favorites` · `GET /api/notifications` · `POST /api/notifications/read` · `POST /api/events`

**Painel — viagens (admin)** — `/api/admin/trips` (CRUD, `export.xlsx`, `sync-tasks`) · `/trips/:id/travelers` (+ `/:ttId/invite`) · `/trips/:id/flights|accommodations|itinerary|tasks` (CRUD) · `/trips/:id/documents` (upload, `/:docId/file` para substituir, `/versions`) · `/trips/:id/highlights/:placeId` · `/api/admin/announcements`

**Painel — conteúdo (admin e editor)** — `/api/admin/destinations` · `/api/admin/places` (+ `POST /places/review` aprovar/rejeitar/arquivar em lote) · `/places/:id/media` · `/content/research-prompt?city&country`

**Painel — importação** — `GET /api/admin/templates/viagem.xlsx|conteudo.xlsx` · `/templates/csv/:ABA.csv` · `POST /api/admin/imports` (multipart: `kind`, `trip_id?`, `spreadsheets[]`, `attachments[]`) · `GET /imports/:id` · `POST /imports/:id/confirm` (`{ notify }`) · `/cancel` · `/errors.csv` · `/annotated.xlsx`

**Painel — sistema (admin)** — `/api/admin/settings` · `/rules` · `/users` · `/audit` · `/metrics` · `/privacy-requests`

## Critérios de aceite do MVP (PRD §13)

| Critério | Situação |
|---|---|
| Admin cria viagem e associa viajantes | ✅ API + testes |
| Viajante acessa por convite seguro, sem cadastro longo | ✅ API + testes |
| Início com destino, datas, contador, progresso e próxima tarefa | ✅ API + tela |
| Importar XLSX/CSV com prévia, validação e confirmação | ✅ API + testes |
| Anexar e substituir documentos sem expor a outros viajantes | ✅ API + testes |
| Roteiro por dia e endereço no mapa | ✅ API + tela |
| Pesquisar e favoritar no guia | ✅ API + tela |
| Botão de ajuda abre WhatsApp configurado com mensagem contextual | ✅ API + tela |
| Importar conteúdo de várias cidades e revisar antes de publicar | ✅ API + testes |
| Alterações relevantes no histórico | ✅ API + testes |

## Observações

- `npm audit` aponta um alerta moderado em dependências internas do `exceljs` (glob/minimatch, usados só para compactar arquivos). O código do app não passa padrões de arquivo para essas bibliotecas; acompanhar a próxima versão do `exceljs`.
- As regras iniciais da jornada de preparação são **exemplos** (PRD §8) e trazem dois links oficiais (Polícia Federal — passaporte; Itamaraty — Portal Consular). A equipe deve revisar textos e links no painel antes de publicar.
