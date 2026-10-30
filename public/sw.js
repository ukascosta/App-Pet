// Service worker: deixa o app abrir offline (só a "casca") e mostra as notificações push.
const CACHE = 'app-pet-v1';
const SHELL = [
  '/', '/styles.css', '/manifest.webmanifest', '/icons/icon.svg',
  '/js/main.js', '/js/api.js', '/js/util.js', '/js/ui.js', '/js/push.js',
  '/js/views/welcome.js', '/js/views/home.js', '/js/views/pet.js', '/js/views/pet-form.js', '/js/views/alerts.js', '/js/views/account.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Arquivos do app: rede primeiro (sempre a versão nova), cache se estiver sem internet. A API nunca é cacheada.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/loja') return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('/'))),
  );
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'App Pet', body: 'Você tem um aviso novo.' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === location.origin);
      if (open) return open.focus().then((w) => w.navigate(target));
      return self.clients.openWindow(target);
    }),
  );
});
