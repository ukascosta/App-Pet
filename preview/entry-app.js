import { boot } from './boot.js';

// O app e o painel da loja usam a mesma página; qual deles abre vem da moldura.
boot.doc === 'loja' ? import('../public/js/loja.js') : import('../public/js/main.js');
