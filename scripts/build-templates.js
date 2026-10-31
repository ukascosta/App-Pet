/** Gera os modelos oficiais em templates/ (os mesmos que o painel oferece para download). */
import fs from 'node:fs';
import { DEFAULT_SETTINGS } from '../server/services/settings.js';
import { buildTemplateXlsx, buildTemplateCsv } from '../server/import/templates.js';
import { ALL_ENTITIES } from '../server/domain/entities.js';

fs.mkdirSync('templates/csv', { recursive: true });
fs.writeFileSync('templates/vagari-modelo-viagem.xlsx', await buildTemplateXlsx('trip', DEFAULT_SETTINGS));
fs.writeFileSync('templates/vagari-modelo-conteudo.xlsx', await buildTemplateXlsx('content', DEFAULT_SETTINGS));
for (const e of ALL_ENTITIES) fs.writeFileSync(`templates/csv/${e.sheet}.csv`, buildTemplateCsv(e.sheet));
console.log('Modelos gerados em templates/.');
