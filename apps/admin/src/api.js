/**
 * API do painel. Em produção fala com o servidor (mesma origem, cookie de sessão).
 * Na prévia (VITE_DEMO=1) usa a simulação em mock.js, com as mesmas respostas.
 */
import { createAdminMock } from './mock.js';

async function call(method, path, body, { form } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: form ? {} : body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: form || (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.error || 'Erro de conexão'), { status: res.status, issues: data?.issues, preview: data?.preview });
  return data;
}
const e = encodeURIComponent;
const SUB = { flights: 'flights', accommodations: 'accommodations', itinerary: 'itinerary', tasks: 'tasks' };

function createLiveApi() {
  return {
    demo: false,
    requestCode: (email) => call('POST', '/api/auth/request-code', { email }),
    verifyCode: (email, code) => call('POST', '/api/auth/verify-code', { email, code }),
    me: () => call('GET', '/api/admin/me'),
    logout: () => call('POST', '/api/auth/logout'),
    trips: (q = {}) => call('GET', `/api/admin/trips?${new URLSearchParams(q)}`),
    trip: (id) => call('GET', `/api/admin/trips/${e(id)}`),
    createTrip: (cells) => call('POST', '/api/admin/trips', cells),
    updateTrip: (id, cells) => call('PATCH', `/api/admin/trips/${e(id)}`, cells),
    addTraveler: (id, cells) => call('POST', `/api/admin/trips/${e(id)}/travelers`, cells),
    updateTraveler: (id, tt, cells) => call('PATCH', `/api/admin/trips/${e(id)}/travelers/${e(tt)}`, cells),
    removeTraveler: (id, tt) => call('DELETE', `/api/admin/trips/${e(id)}/travelers/${e(tt)}`),
    invite: (id, tt, send_email = true) => call('POST', `/api/admin/trips/${e(id)}/travelers/${e(tt)}/invite`, { send_email }),
    saveItem: (id, kind, itemId, cells) => (itemId ? call('PATCH', `/api/admin/trips/${e(id)}/${SUB[kind]}/${e(itemId)}`, cells) : call('POST', `/api/admin/trips/${e(id)}/${SUB[kind]}`, cells)),
    deleteItem: (id, kind, itemId) => call('DELETE', `/api/admin/trips/${e(id)}/${SUB[kind]}/${e(itemId)}`),
    uploadDocument: (id, form) => call('POST', `/api/admin/trips/${e(id)}/documents`, undefined, { form }),
    updateDocument: (id, docId, cells) => call('PATCH', `/api/admin/trips/${e(id)}/documents/${e(docId)}`, cells),
    replaceDocument: (id, docId, form) => call('POST', `/api/admin/trips/${e(id)}/documents/${e(docId)}/file`, undefined, { form }),
    deleteDocument: (id, docId) => call('DELETE', `/api/admin/trips/${e(id)}/documents/${e(docId)}`),
    announce: (body) => call('POST', '/api/admin/announcements', body),
    setHighlight: (id, placeId, note) => call('PUT', `/api/admin/trips/${e(id)}/highlights/${e(placeId)}`, { note }),
    removeHighlight: (id, placeId) => call('DELETE', `/api/admin/trips/${e(id)}/highlights/${e(placeId)}`),
    destinations: () => call('GET', '/api/admin/destinations'),
    saveDestination: (id, cells) => (id ? call('PATCH', `/api/admin/destinations/${e(id)}`, cells) : call('POST', '/api/admin/destinations', cells)),
    places: (q = {}) => call('GET', `/api/admin/places?${new URLSearchParams(q)}`),
    savePlace: (id, cells) => (id ? call('PATCH', `/api/admin/places/${e(id)}`, cells) : call('POST', '/api/admin/places', cells)),
    reviewPlaces: (ids, action) => call('POST', '/api/admin/places/review', { ids, action }),
    researchPrompt: (q) => call('GET', `/api/admin/content/research-prompt?${new URLSearchParams(q)}`),
    imports: () => call('GET', '/api/admin/imports'),
    previewImport: (form) => call('POST', '/api/admin/imports', undefined, { form }),
    confirmImport: (id, notify) => call('POST', `/api/admin/imports/${e(id)}/confirm`, { notify }),
    cancelImport: (id) => call('POST', `/api/admin/imports/${e(id)}/cancel`, {}),
    templateUrl: (kind) => `/api/admin/templates/${kind}.xlsx`,
    errorsUrl: (id) => `/api/admin/imports/${e(id)}/errors.csv`,
    annotatedUrl: (id) => `/api/admin/imports/${e(id)}/annotated.xlsx`,
    exportUrl: (id) => `/api/admin/trips/${e(id)}/export.xlsx`,
    rules: () => call('GET', '/api/admin/rules'),
    saveRule: (id, body) => (id ? call('PATCH', `/api/admin/rules/${e(id)}`, body) : call('POST', '/api/admin/rules', body)),
    deleteRule: (id) => call('DELETE', `/api/admin/rules/${e(id)}`),
    settings: () => call('GET', '/api/admin/settings'),
    saveSettings: (patch) => call('PATCH', '/api/admin/settings', patch),
    users: () => call('GET', '/api/admin/users'),
    saveUser: (body) => call('POST', '/api/admin/users', body),
    updateUser: (id, body) => call('PATCH', `/api/admin/users/${e(id)}`, body),
    audit: (q = {}) => call('GET', `/api/admin/audit?${new URLSearchParams(q)}`),
    metrics: () => call('GET', '/api/admin/metrics'),
    privacyRequests: () => call('GET', '/api/admin/privacy-requests'),
    updatePrivacy: (id, status) => call('PATCH', `/api/admin/privacy-requests/${e(id)}`, { status }),
  };
}

export const api = import.meta.env.VITE_DEMO ? createAdminMock() : createLiveApi();
