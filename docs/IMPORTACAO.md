# Guia de importação para a equipe Vagari

Modelos oficiais: `templates/vagari-modelo-viagem.xlsx` e `templates/vagari-modelo-conteudo.xlsx` (também para download no painel). Cada aba também existe como CSV em `templates/csv/`.

## Regras de ouro

1. **Não renomeie abas nem colunas.** Colunas em vermelho-escuro são obrigatórias para criar um registro novo. Passe o mouse no cabeçalho para ver formato e exemplo; a aba **CAMPOS** explica tudo.
2. **Preencha só o que precisar.** Abas vazias são ignoradas. Para atualizar um registro existente basta a coluna-chave e as colunas que mudaram.
3. **IDs estáveis.** `trip_id`, `destination_id` e `content_id` identificam o registro: se já existir, ele é **atualizado**; se não, **criado**. Nunca reaproveite um ID para outra coisa.
4. **Nada é apagado pela planilha.** Linha ausente não exclui nada; célula vazia mantém o valor atual. Para apagar um campo opcional, escreva `[limpar]`. Para excluir um registro, use o painel.
5. **Datas e horas são locais.** Voo: hora local de cada aeroporto. Formatos aceitos: `2026-12-20`, `20/12/2026`, `20/12/2026 22:40`, `09:30`, `9h30`.
6. **Arquivos vão junto.** Na aba DOCUMENTS (ou MEDIA), escreva o nome exato do arquivo e anexe-o no mesmo upload. PDF, JPG, PNG ou WEBP. Links `https://` funcionam, mas prefira enviar o arquivo.

## Chaves de cada aba

| Aba | Chave (atualiza em vez de duplicar) |
|---|---|
| TRIPS | `trip_id` |
| TRAVELERS | `trip_id` + `traveler_email` |
| FLIGHTS | `trip_id` + `segment_order` |
| ACCOMMODATIONS | `accommodation_id` **ou** nome + data do check-in |
| ITINERARY | `item_id` **ou** data + início + título |
| DOCUMENTS | `document_id` **ou** nome do documento |
| TASKS | `task_id` **ou** título |
| DESTINATIONS | `destination_id` |
| PLACES | `content_id` |
| MEDIA | `content_id` + `display_order` |

Dica: para editar uma viagem já cadastrada, use **Exportar planilha** no painel. O arquivo sai com todos os IDs; edite e reimporte.

## O que acontece no upload

1. O sistema lê a planilha e mostra uma **prévia**: quantos registros serão criados, atualizados (com o valor antigo → novo) ou ficam iguais, e os **erros e avisos por linha e coluna**, com instrução de correção.
2. Erros bloqueiam a importação. Avisos (ex.: "possível duplicidade", "voo fora das datas da viagem") não bloqueiam, mas merecem atenção.
3. Com erros, baixe o **relatório (CSV)** ou a **planilha com apontamentos** (a sua planilha com uma coluna ERROS e as células com problema pintadas), corrija e envie de novo.
4. Ao confirmar, tudo é gravado de uma vez (ou nada, se algo falhar) e fica no histórico. Marque **"avisar viajantes"** se a mudança for importante.

## Conteúdo (destinos e lugares)

- Toda importação de lugares entra como **Pendente de revisão** e só aparece no app depois de aprovada no painel.
- Se um lugar publicado for alterado pela planilha, ele volta para revisão.
- Para pesquisar uma cidade com o Claude, gere o prompt no painel (Conteúdo › Pesquisar cidade). Ele já sai com as colunas exatas da aba PLACES e as categorias configuradas.
- Não invente dados: horário, preço ou endereço sem fonte confiável ficam em branco, com a explicação em `verification_notes`.
