# 🐾 App Pet — controle de ração para cães e gatos

App simples para o tutor saber **quando a ração do pet vai acabar** e para a **loja ser avisada pelo WhatsApp** na hora certa de oferecer a reposição.

- **Tutor** cadastra nome, e-mail e WhatsApp, e depois o pet (raça, cor, idade, quanto compra de ração por mês).
- O app sugere **quanto o pet deve comer por dia** e **desconta a ração sozinho**, todos os dias.
- Quando faltam poucos dias (padrão: 7), o app **avisa o tutor** (no app, push e e-mail) e **avisa a loja no WhatsApp**.
- A loja tem um **painel** (`/loja`) com os clientes para atender e um botão "Chamar no WhatsApp" que já abre a conversa com a mensagem pronta.

É um PWA: funciona no navegador do celular e pode ser instalado na tela inicial, sem loja de aplicativos.

## Rodando

Precisa de Node 22 ou mais novo.

```bash
npm install
cp .env.example .env     # ajuste o nome e o WhatsApp da loja
npm start                # http://localhost:3000
npm test                 # 46 testes
```

- App do tutor: `http://localhost:3000`
- Painel da loja: `http://localhost:3000/loja` (senha = `STORE_ADMIN_PASSWORD`; se estiver vazia em desenvolvimento, uma senha é gerada e mostrada no terminal)

## Como funciona

### Sugestão de porção por raça

O catálogo tem **mais de 100 raças de cães** (incluindo SRD/vira-lata por porte e as mais comuns no Brasil) e **mais de 30 de gatos**, além da opção "Outra raça", cada uma com a faixa de peso adulto. A porção diária vem da fórmula padrão da nutrição clínica veterinária (NRC 2006, AAHA 2021, WSAVA):

```
RER (kcal/dia) = 70 × peso_kg^0,75
DER (kcal/dia) = RER × fator da fase de vida
gramas/dia     = DER ÷ kcal por kg da ração
```

O fator depende de espécie, idade (filhote, adulto, sênior), porte e se o pet é castrado. Se o tutor não informa o peso, ele é estimado pela raça e idade. A ração padrão é de 3.800 kcal/kg (cães) e 4.000 kcal/kg (gatos); o tutor pode informar o valor da embalagem em "Opções avançadas". O código está em [`server/lib/nutrition.js`](server/lib/nutrition.js).

> ⚠️ **É uma referência, não uma prescrição.** Os números batem com tabelas de embalagens comuns, mas **recomendo que um veterinário revise as faixas** (fatores, idades de porte/sênior e pesos por raça) antes de lançar. O app já avisa o tutor que a embalagem e o veterinário têm a palavra final.

### Contagem regressiva automática

Não existe um job que subtrai ração todo dia. O banco guarda o estoque medido em um instante e o consumo diário; o estoque de agora é **calculado** (`server/lib/stock.js`). Fica exato mesmo se o servidor ficar fora do ar.

O tutor escolhe como o consumo é calculado: **sugestão veterinária**, **pelo que compra** (compra mensal ÷ 30) ou **quantidade própria**. Ele pode registrar "Comprei ração" (soma ao estoque) ou "Ajustar quanto tem em casa" (corrige o valor).

### Avisos

Cada pet tem um estado: `ok → low (acabando) → empty (acabou)`. Cada subida de gravidade dispara **um** aviso; repor o estoque zera o ciclo e encerra o pedido aberto na loja. O servidor confere tudo a cada `CHECK_INTERVAL_MINUTES` e também logo após qualquer alteração do tutor.

Os envios passam por uma **fila com nova tentativa** (`outbox`): se o WhatsApp estiver fora do ar, o servidor tenta de novo (até 5 vezes, com espera crescente) e o pedido continua visível no painel da loja, que mostra se o aviso automático chegou ou falhou.

| Destino | Canal | Como ligar |
|---|---|---|
| Loja | WhatsApp automático | `WHATSAPP_PROVIDER` (abaixo) + `STORE_WHATSAPP` |
| Loja | Painel `/loja` | Sempre ligado, não depende de nada |
| Tutor | Dentro do app | Sempre ligado |
| Tutor | Push no celular | O tutor ativa na aba Avisos (chaves VAPID geradas sozinhas) |
| Tutor | E-mail | `SMTP_URL` |

### WhatsApp da loja

Escolha com `WHATSAPP_PROVIDER` no `.env`:

- `console` (padrão): só escreve a mensagem no log. Bom para testar.
- `meta`: API oficial do **WhatsApp Cloud (Meta)**. Mensagens iniciadas pela empresa fora da janela de 24 h exigem um **template aprovado**; crie um com 4 variáveis (`{{1}}` cliente, `{{2}}` pet, `{{3}}` dias restantes, `{{4}}` WhatsApp do cliente) e informe o nome em `WHATSAPP_META_TEMPLATE`.
- `webhook`: envia um `POST` JSON para a URL em `WHATSAPP_WEBHOOK_URL`. Serve para Z-API, Evolution API, n8n, Make etc.

No painel `/loja`, "Configuração → Enviar mensagem de teste" confere se o provedor está certo.

## Privacidade (LGPD)

- O cadastro exige o **aceite** para a loja entrar em contato por WhatsApp; a data do aceite é guardada.
- O tutor pode **apagar o cadastro e todos os dados** em Conta → "Apagar meu cadastro e meus dados".
- O token de login nunca fica no banco, apenas o hash.

## Limitações conhecidas (próximos passos)

- **"WhatsApp ativo" é validado só pelo formato** (celular brasileiro com DDD ou número internacional com `+`). Confirmar que o número recebe mensagens exige enviar um código por WhatsApp; entra quando o provedor estiver definido.
- **Login por e-mail + WhatsApp, sem código de confirmação.** Quem souber os dois consegue ver os pets daquela pessoa. O ideal é confirmar por código (WhatsApp ou e-mail).
- **Uma loja por instalação.** Várias lojas pedem um cadastro de lojas e escolha na hora do registro.
- **O servidor precisa ficar ligado** (a conferência é um temporizador interno) e o SQLite exige **disco persistente** e uma única instância. Evite hospedagem que "dorme" por inatividade.
- **Push** só funciona com HTTPS. No iPhone, só depois de adicionar o app à Tela de Início.
- Sem tema escuro. Todo o visual está em tokens no início de `public/styles.css`, então trocar cores, bordas e fontes é rápido quando chegarem as referências de layout.

## Estrutura

```
server/
  index.js              inicia servidor e conferência periódica
  app.js                monta o Express
  db.js                 esquema SQLite
  data/breeds.js        catálogo de raças
  lib/nutrition.js      sugestão de porção
  lib/stock.js          estoque e contagem regressiva
  services/alerts.js    estados do alerta + fila de envios
  services/whatsapp.js  provedores (console / meta / webhook)
  routes/               API do tutor, da loja e pública
public/                 PWA (HTML + JS puro, sem build)
test/                   testes (node --test)
```

## Variáveis de ambiente

Veja [`.env.example`](.env.example), comentado. As principais: `STORE_NAME`, `STORE_WHATSAPP`, `STORE_ADMIN_PASSWORD`, `WHATSAPP_PROVIDER`, `DATABASE_PATH`. Em produção (`NODE_ENV=production`) a senha da loja é obrigatória; atrás de proxy reverso use `TRUST_PROXY=1`.
