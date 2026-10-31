import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// O painel é servido pelo próprio servidor da Vagari em /painel (produção)
// e roda com dados de demonstração na prévia (VITE_DEMO=1).
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: { alias: { '@shared': path.resolve(__dirname, '../../shared') } },
  server: { fs: { allow: ['..', '../../shared'] }, proxy: { '/api': 'http://localhost:3000' } },
  build: { chunkSizeWarningLimit: 2000 },
});
