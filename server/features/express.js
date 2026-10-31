// Monta uma tabela de rotas (features/api.js) num Router do Express.

import { Router } from 'express';

export function mountRoutes(table, makeCtx, middleware = []) {
  const router = Router();
  for (const [method, path, fn] of table) {
    router[method.toLowerCase()](path, ...middleware, (req, res) => {
      const out = fn(makeCtx(req));
      const { status = 200, body } = out && 'status' in out && Object.keys(out).every((k) => k === 'status' || k === 'body') ? out : { body: out };
      if (status === 204) return res.status(204).end();
      res.status(status).json(body);
    });
  }
  return router;
}

/** Converte req.query (objeto) em URLSearchParams, como a pré-visualização entrega. */
export const queryOf = (req) => new URLSearchParams(Object.entries(req.query).map(([k, v]) => [k, String(v)]));
