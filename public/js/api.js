const TOKEN_KEY = 'apppet.token';

let token = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {
  /* navegação privada: o login vale só até fechar a aba */
}

export const getToken = () => token;

export function setToken(value) {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignora */
  }
}

export class ApiError extends Error {
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Sem conexão com a internet. Tente de novo.');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    // Sessão expirada: volta para o login. (Senha errada também é 401, mas aí não há sessão ativa.)
    if (res.status === 401 && token && !path.startsWith('/session')) {
      setToken(null);
      location.hash = '#/entrar';
    }
    throw new ApiError(res.status, data?.error ?? 'Algo deu errado. Tente de novo.', data?.field);
  }
  return data;
}

export const api = {
  config: () => request('GET', '/config'),
  breeds: (species) => request('GET', `/breeds?species=${species}`),
  recommend: (draft) => request('POST', '/recommendation', draft),

  register: (data) => request('POST', '/customers', data),
  login: (data) => request('POST', '/session', data),
  logout: () => request('DELETE', '/session'),
  forgotPassword: (email) => request('POST', '/password/forgot', { email }),
  resetPassword: (token, password) => request('POST', '/password/reset', { token, password }),
  changePassword: (data) => request('PUT', '/me/password', data),
  oauthExchange: (code) => request('POST', '/oauth/exchange', { code }),
  me: () => request('GET', '/me'),
  updateMe: (data) => request('PATCH', '/me', data),
  deleteMe: () => request('DELETE', '/me'),

  createPet: (data) => request('POST', '/pets', data),
  updatePet: (id, data) => request('PATCH', `/pets/${id}`, data),
  deletePet: (id) => request('DELETE', `/pets/${id}`),
  restock: (id, kg) => request('POST', `/pets/${id}/restock`, { kg }),
  setStock: (id, kg) => request('POST', `/pets/${id}/stock`, { kg }),

  // clube, vitrine, pedidos, pontos e agenda
  summary: () => request('GET', '/summary'),
  showcase: () => request('GET', '/showcase'),
  quote: (data) => request('POST', '/orders/quote', data),
  order: (data) => request('POST', '/orders', data),
  orders: () => request('GET', '/orders'),
  cancelOrder: (id) => request('POST', `/orders/${id}/cancel`),
  club: () => request('GET', '/club'),
  subscribeClub: () => request('POST', '/club/subscribe'),
  cancelClub: () => request('POST', '/club/cancel'),
  points: () => request('GET', '/points'),
  redeem: (rewardId) => request('POST', '/points/redeem', { rewardId }),
  care: () => request('GET', '/care'),
  addCare: (data) => request('POST', '/care', data),
  careDone: (id) => request('POST', `/care/${id}/done`),
  deleteCare: (id) => request('DELETE', `/care/${id}`),
  book: (data) => request('POST', '/appointments', data),
  cancelAppointment: (id) => request('POST', `/appointments/${id}/cancel`),

  alerts: () => request('GET', '/alerts'),
  readAlerts: () => request('POST', '/alerts/read'),
  pushSubscribe: (sub) => request('POST', '/push/subscribe', sub),
  pushUnsubscribe: (endpoint) => request('POST', '/push/unsubscribe', { endpoint }),
};
