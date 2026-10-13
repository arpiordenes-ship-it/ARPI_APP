// Hace que la app abra aunque no haya señal y que las versiones nuevas lleguen solas.
// Regla: la página siempre se pide primero a internet (así un cambio publicado se ve al abrir);
// si no hay conexión, se usa la última copia guardada. Las llamadas al servidor de Google
// (guardar, consultar) nunca se guardan aquí: esas las maneja la propia app.
const COPIA = 'ordenes-v2';
const BASE = ['./', 'manifest.webmanifest', 'icono-192.png', 'icono-512.png', 'carga-logo.png', 'carga-ondas.jpg', 'carga-fondo.jpg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(COPIA).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(nombres => Promise.all(nombres.filter(n => n !== COPIA).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const pedido = e.request;
  if (pedido.method !== 'GET' || new URL(pedido.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(pedido)
      .then(respuesta => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(COPIA).then(c => c.put(pedido, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(pedido, { ignoreSearch: true }).then(r => r || caches.match('./')))
  );
});
