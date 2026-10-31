# App nas lojas — situação e próximos passos

O app do viajante é feito em **Expo / React Native** (`apps/mobile`): um código para iOS e Android.

## O que já está pronto

- Todas as telas do MVP (abertura, apresentação, login, convite, interesses, Início, Roteiro, Explorar, Preparação, Docs, detalhes, perfil, ajuda, notificações, privacidade).
- Design system Vagari (`shared/tokens.js`), ícones Lucevias, fontes Outfit + Plus Jakarta Sans embutidas.
- Modo demonstração com dados fictícios e um cliente da API real (`apps/mobile/src/lib/api.js`) com as mesmas respostas do servidor.
- `app.json` com identificadores `br.com.vagari.app`, esquema `vagari://`, link universal para os convites (`https://app.vagari.com.br/convite/...`) e "Sign in with Apple" habilitado.

## Login simples (como ficou)

1. **Convite**: a Vagari envia um link pessoal; tocar nele abre o app já logado.
2. **Apple** ou **Google**: um toque (o e-mail precisa ser o mesmo cadastrado pela Vagari).
3. **E-mail + código de 6 números**: sem senha, com preenchimento automático do código no iOS/Android.

A Apple exige "Entrar com Apple" sempre que o app oferece login com Google — por isso os dois.

## Para publicar (o que falta)

| Item | Quem | Observação |
|---|---|---|
| Conta Apple Developer (US$ 99/ano) e Google Play Console (US$ 25 uma vez) | Vagari | Em nome da empresa (CNPJ), com D-U-N-S para a Apple. |
| Logo em SVG, ícone do app e splash | Vagari → dev | Hoje há um wordmark provisório em texto. |
| Arquivos da fonte **Neulis** + licença para app e web | Vagari | Hoje os títulos usam Outfit no lugar. |
| Cores oficiais (HEX) | Vagari | Trocar só em `shared/tokens.js`. |
| Fotos com licença | Vagari ou liberar download | Ver `docs/FOTOS.md`. |
| Login Apple/Google no servidor | dev | Validar o token da Apple/Google e associar ao e-mail já cadastrado. |
| Guardar a sessão com `expo-secure-store` e notificações push (`expo-notifications`) | dev | O servidor já tem notificações no app e por e-mail. |
| Documentos offline (`expo-file-system`) e abrir PDF | dev | Hoje o visualizador da prévia é ilustrativo. |
| Política de privacidade e termos publicados (URL) | Vagari + jurídico | Exigido pelas duas lojas. |
| Domínio `app.vagari.com.br` com os arquivos de link universal | dev | Para o convite abrir direto no app. |
| Build e envio: `npx eas-cli build` / `npx eas-cli submit` | dev | |

## Por que a navegação usa React Navigation (e não Expo Router)

A prévia web roda dentro de uma subpasta de um link compartilhado. O Expo Router amarra as telas à URL do navegador, o que quebra nesse cenário; o React Navigation guarda a navegação em memória e funciona igual no celular e na prévia. Dá para migrar depois sem mudar as telas.
