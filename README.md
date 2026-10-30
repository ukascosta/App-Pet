# 🐾 PetLee — controle de ração para cães e gatos

App para o tutor saber **quando a ração do pet vai acabar** e para a **loja ser avisada pelo WhatsApp** na hora certa de oferecer a reposição.

- O **tutor** cria a conta (senha, Google ou Facebook) e cadastra o pet: raça, cor, idade, quanto compra de ração por mês e **quantas vezes por dia costuma alimentar**.
- O app sugere **quanto o pet deve comer por dia**, **quantas refeições** e **em quais horários**, conforme a raça e a idade, e **desconta a ração sozinho**, todos os dias.
- Quando faltam poucos dias (padrão: 7), o app **avisa o tutor** (no app, push e e-mail) e **avisa a loja no WhatsApp**.
- A loja tem um **painel** (`/loja`) com os clientes para atender e um botão "Chamar no WhatsApp" que já abre a conversa com a mensagem pronta.

É um PWA: funciona no navegador do celular e pode ser instalado na tela inicial, sem loja de aplicativos.

## Rodando

Precisa de Node 22 ou mais novo.

```bash
npm install
cp .env.example .env     # ajuste o nome e o WhatsApp da loja
npm start                # http://localhost:3000
npm test                 # 76 testes
```

- App do tutor: `http://localhost:3000`
- Painel da loja: `http://localhost:3000/loja` (senha = `STORE_ADMIN_PASSWORD`; se estiver vazia em desenvolvimento, uma senha é gerada e mostrada no terminal)

## Telas

Abertura animada do logo · boas-vindas (3 slides) · entrar · criar conta · esqueci a senha · nova senha · completar cadastro (quem entra com Google/Facebook) · início · cadastro do pet em 4 passos (quem é, idade e peso, ração, rotina de refeições) · tela de sucesso · detalhe do pet · editar pet · avisos · conta (dados, senha, loja) · painel da loja.

## Visual

As cores vêm do logo: **preto `#000`, laranja `#FF8801` e verde-menta `#27D6AF`**, sobre um branco levemente alaranjado (`#FFF6EC`). O laranja é a cor principal (botões, destaques); o verde aparece nos detalhes (anéis de progresso, avisos, selos); o preto, nos cartões de destaque e na barra de navegação. Botões laranja usam texto preto, que passa com folga no teste de contraste (7,9:1; branco sobre esse laranja daria só 2,3:1).

- **Todos os tokens** (cores, raios, sombras, fontes) ficam no começo de `public/styles.css`.
- **Logo em vetor** (traçado a partir dos arquivos enviados): `public/brand/*.svg` e `public/js/brand.js`. Cada peça (cabeça, coleira, letras) é separada para animar a abertura.
- **Ilustrações e ícones**: `public/js/art.js` e `public/js/icons.js`. Os avatares dos pets usam a **cor do pelo** informada no cadastro.
- **Fontes**: Fredoka (títulos, parente das letras do logo) e Nunito (texto), ambas licença OFL, embarcadas em `public/fonts/`.
- Sobre o laranja, o logo aparece em uma "pílula" clara para manter as cores oficiais legíveis (o verde-menta sobre laranja tem contraste de só 1,6:1).

## Como funciona

### Sugestão de porção por raça

O catálogo tem **mais de 100 raças de cães** (incluindo SRD/vira-lata por porte e as mais comuns no Brasil) e **mais de 30 de gatos**, além da opção "Outra raça", cada uma com a faixa de peso adulto. A porção diária vem da fórmula padrão da nutrição clínica veterinária (NRC 2006, AAHA 2021, WSAVA):

```
RER (kcal/dia) = 70 × peso_kg^0,75
DER (kcal/dia) = RER × fator da fase de vida
gramas/dia     = DER ÷ kcal por kg da ração
```

O fator depende de espécie, idade (filhote, adulto, sênior), porte e se o pet é castrado. Se o tutor não informa o peso, ele é estimado pela raça e idade. A ração padrão é de 3.800 kcal/kg (cães) e 4.000 kcal/kg (gatos); o tutor pode informar o valor da embalagem em "Opções avançadas". Código em [`server/lib/nutrition.js`](server/lib/nutrition.js).

> ⚠️ **É uma referência, não uma prescrição.** Os números batem com tabelas de embalagens comuns, mas **recomendo que um veterinário revise as faixas** (fatores, idades de porte/sênior, pesos por raça e as orientações de refeição) antes de lançar. O app já avisa o tutor que a embalagem e o veterinário têm a palavra final.

### Rotina de refeições (quantas vezes e a que horas)

O tutor informa quantas vezes por dia costuma alimentar (1 a 6) e os horários; o app mostra a **sugestão para a raça e a idade** e a porção de cada refeição. A regra está em [`server/lib/feeding.js`](server/lib/feeding.js):

| Perfil | Sugestão |
|---|---|
| Filhote de cão até 4 meses | 4× ao dia |
| Filhote de cão de 4 a 6 meses | 3× ao dia |
| Filhote após 6 meses | 2× (raça pequena segue em 3× até a maturidade) |
| Cão adulto | 2× ao dia (07:30 e 18:30) |
| Raça muito pequena (adulto até 4 kg) | 3× ao dia: risco de queda de açúcar no sangue |
| Raças de peito profundo (Dogue Alemão, Pastor Alemão, Setter etc.) | no mínimo 2×, com alerta de torção gástrica e de exercício perto da refeição |
| Gatos | 4× até 4 meses, depois 3× ao dia |

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

## Login

- **E-mail e senha**, sem código de verificação. As senhas são guardadas com `scrypt` (nunca em texto). Há limite de tentativas por IP e por e-mail.
- **Esqueci a senha**: o servidor envia um link de uso único (vale 1 hora). Precisa de `SMTP_URL`; em desenvolvimento, sem SMTP, o link aparece no log do servidor. Redefinir a senha desconecta os outros aparelhos.
- **Entrar com Google ou Facebook**: fluxo OAuth feito pelo servidor (sem script de terceiros no app). Quem entra assim completa o WhatsApp e o aceite de contato antes de cadastrar pets.

### Ligando o login com Google e Facebook

Os botões aparecem sempre em desenvolvimento (para você ver o layout) e só em produção se estiverem configurados. Sem as chaves, o clique volta ao login com um aviso.

1. Defina `PUBLIC_URL` com o endereço real do app (com `https` em produção).
2. **Google**: em [console.cloud.google.com](https://console.cloud.google.com) › *APIs e serviços* › *Credenciais* › *ID do cliente OAuth* (tipo "Aplicativo da Web"). Em **URIs de redirecionamento autorizados** coloque `{PUBLIC_URL}/auth/google/callback`. Copie o ID e o segredo para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.
3. **Facebook**: em [developers.facebook.com](https://developers.facebook.com) crie um app com o produto *Login do Facebook*. Em **URIs de redirecionamento do OAuth válidos** coloque `{PUBLIC_URL}/auth/facebook/callback`. Copie o ID e a chave secreta do app para `FACEBOOK_APP_ID` e `FACEBOOK_APP_SECRET`. Enquanto o app estiver em modo de desenvolvimento, só contas de testadores conseguem entrar.

**Segurança da junção de contas:** se o e-mail do Google/Facebook já tem uma conta criada **por senha** que nunca provou ser do dono do e-mail (sem redefinição de senha ou login social), a senha, as sessões e o WhatsApp dessa conta são apagados e ela passa para quem acabou de provar o e-mail. Isso impede que alguém cadastre o e-mail de outra pessoa de antemão e continue com acesso depois. O pet e o histórico ficam.

## Privacidade (LGPD)

- O cadastro exige o **aceite** para a loja entrar em contato por WhatsApp; a data do aceite é guardada.
- O tutor pode **apagar o cadastro e todos os dados** em Conta › "Apagar meu cadastro e meus dados".
- Tokens de sessão e links de uso único nunca ficam no banco, só o hash.

## Limitações conhecidas (próximos passos)

- **"WhatsApp ativo" é validado só pelo formato** (celular brasileiro com DDD ou número internacional com `+`). Confirmar que o número recebe mensagens exige enviar um código por WhatsApp; entra quando o provedor estiver definido.
- **O e-mail não é confirmado no cadastro** (decisão de produto: sem código de verificação). O cuidado com a junção de contas acima reduz o risco, mas quem quiser garantir que o e-mail é do tutor precisará de uma confirmação por link.
- **O login com Google e Facebook foi testado com provedores simulados**, não com contas reais: faltam as suas chaves para o teste final.
- **Uma loja por instalação.** Várias lojas pedem um cadastro de lojas e escolha na hora do registro.
- **O servidor precisa ficar ligado** (a conferência é um temporizador interno) e o SQLite exige **disco persistente** e uma única instância. Evite hospedagem que "dorme" por inatividade.
- **Push** só funciona com HTTPS. No iPhone, só depois de adicionar o app à Tela de Início.
- Sem tema escuro.

## Estrutura

```
server/
  index.js              inicia servidor e conferência periódica
  app.js                monta o Express
  db.js                 esquema SQLite e migração da versão anterior
  data/breeds.js        catálogo de raças
  lib/nutrition.js      sugestão de porção
  lib/feeding.js        rotina de refeições por raça e idade
  lib/stock.js          estoque e contagem regressiva
  lib/password.js       hash de senha (scrypt)
  services/alerts.js    estados do alerta + fila de envios
  services/oauth.js     login com Google e Facebook
  services/whatsapp.js  provedores (console / meta / webhook)
  routes/               API do tutor, da loja, pública e de autenticação
public/                 PWA (HTML + JS puro, sem build)
  brand/ fonts/ icons/  logo, fontes e ícones do app
  js/art.js, icons.js   ilustrações e ícones
test/                   testes (node --test)
```

## Variáveis de ambiente

Veja [`.env.example`](.env.example), comentado. As principais: `STORE_NAME`, `STORE_WHATSAPP`, `STORE_ADMIN_PASSWORD`, `PUBLIC_URL`, `WHATSAPP_PROVIDER`, `DATABASE_PATH`. Em produção (`NODE_ENV=production`) a senha da loja é obrigatória; atrás de proxy reverso use `TRUST_PROXY=1`.
