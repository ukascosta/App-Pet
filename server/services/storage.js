import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { newId } from '../lib/ids.js';

/**
 * Armazenamento privado de arquivos em disco. Os arquivos NUNCA ficam numa pasta pública:
 * só saem pelo servidor, depois da checagem de permissão (ou por link assinado de curta duração).
 * A interface (put/read/remove) permite trocar por S3/R2/GCS sem mexer no resto do código.
 */
export function createStorage(dir) {
  const root = path.resolve(dir);
  fs.mkdirSync(root, { recursive: true });

  const fullPath = (key) => {
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(key)) throw new Error('chave de arquivo inválida');
    return path.join(root, key.slice(0, 2), key);
  };

  return {
    /** Grava um buffer e devolve a chave privada. */
    putBuffer(buffer) {
      const key = newId('f');
      const p = fullPath(key);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, buffer, { mode: 0o600 });
      return key;
    },
    exists: (key) => fs.existsSync(fullPath(key)),
    stream: (key) => fs.createReadStream(fullPath(key)),
    readBuffer: (key) => fs.readFileSync(fullPath(key)),
    remove(key) {
      try {
        fs.unlinkSync(fullPath(key));
      } catch {
        /* já removido */
      }
    },
  };
}

export const sha256Buffer = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const TYPES = {
  pdf: { mime: 'application/pdf', test: (b) => b.subarray(0, 4).toString('latin1') === '%PDF' },
  png: { mime: 'image/png', test: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  jpg: { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  jpeg: { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  webp: {
    mime: 'image/webp',
    test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
  gif: { mime: 'image/gif', test: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
};

export const DOCUMENT_TYPES = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
export const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

/**
 * Confere extensão E conteúdo (assinatura do arquivo) — não confiamos no tipo enviado pelo navegador.
 * Devolve { mime } ou { error }.
 */
export function sniffFile(fileName, buffer, allowed) {
  const ext = String(fileName).toLowerCase().split('.').pop();
  if (!allowed.includes(ext)) {
    return { error: `Tipo de arquivo não aceito: "${fileName}". Aceitos: ${allowed.join(', ')}.` };
  }
  if (!buffer?.length || !TYPES[ext].test(buffer)) {
    return { error: `O conteúdo de "${fileName}" não corresponde a um arquivo .${ext} válido.` };
  }
  return { mime: TYPES[ext].mime };
}
