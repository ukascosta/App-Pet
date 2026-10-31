/**
 * Cliente da API. Com "extra.apiUrl" no app.json (ou EXPO_PUBLIC_API_URL) fala com o servidor real;
 * sem isso roda no modo demonstração (shared/demo.js), com os mesmos formatos de resposta.
 */
import Constants from 'expo-constants';
import { createMockApi } from '../../../../shared/demo.js';

const fromConfig = Constants.expoConfig?.extra?.apiUrl;
const API_URL = process.env.EXPO_PUBLIC_API_URL || (typeof fromConfig === 'string' && fromConfig ? fromConfig : null);

function createHttpApi(base) {
  let token = null; // TODO (etapa de publicação): guardar no expo-secure-store
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error(data?.error || 'Deu ruim na conexão. Tenta de novo?'), { status: res.status });
    return data;
  };
  const e = encodeURIComponent;
  return {
    mode: 'live',
    requestCode: (email) => call('POST', '/api/auth/request-code', { email }),
    verifyCode: async (email, code) => {
      const r = await call('POST', '/api/auth/verify-code', { email, code });
      token = r.token;
      return r;
    },
    socialLogin: async () => {
      throw new Error('Login com Apple/Google entra na etapa de publicação nas lojas.');
    },
    inviteInfo: (t) => call('GET', `/api/auth/invite/${e(t)}`),
    acceptInvite: async (t) => {
      const r = await call('POST', `/api/auth/invite/${e(t)}/accept`);
      token = r.token;
      return r;
    },
    logout: () => call('POST', '/api/auth/logout'),
    me: () => call('GET', '/api/me'),
    updateMe: (p) => call('PATCH', '/api/me', p),
    privacyRequest: (kind, message) => call('POST', '/api/me/privacy-requests', { kind, message }),
    home: (id) => call('GET', `/api/trips/${e(id)}`),
    itinerary: (id) => call('GET', `/api/trips/${e(id)}/itinerary`),
    tasks: (id) => call('GET', `/api/trips/${e(id)}/tasks`),
    setTaskDone: (id, taskId, done) => call(done ? 'POST' : 'DELETE', `/api/trips/${e(id)}/tasks/${e(taskId)}/complete`),
    documents: (id) => call('GET', `/api/trips/${e(id)}/documents`),
    guide: (id, params = {}) => call('GET', `/api/trips/${e(id)}/guide?${new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()}`),
    place: (id) => call('GET', `/api/places/${e(id)}`),
    setFavorite: (id, on) => call(on ? 'POST' : 'DELETE', `/api/places/${e(id)}/favorite`),
    favorites: () => call('GET', '/api/favorites'),
    help: (id) => call('GET', `/api/trips/${e(id)}/help`),
    notifications: () => call('GET', '/api/notifications'),
    readNotifications: () => call('POST', '/api/notifications/read', {}),
    event: (name, trip_id) => call('POST', '/api/events', { name, trip_id }).catch(() => null),
    inspiration: async () => ({ destinations: [] }),
    destination: async () => null,
  };
}

export const api = API_URL ? createHttpApi(API_URL) : createMockApi({ scenario: 'before' });
