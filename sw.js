// Hace tres cosas: que la app abra aunque no haya señal, que las versiones nuevas lleguen solas
// y que el aparato muestre los avisos de órdenes aunque la app esté cerrada.
const COPIA = 'ordenes-v16';
const BASE = ['./', 'manifest.webmanifest', 'icono-192.png', 'icono-512.png', 'carga-logo.png', 'carga-ondas.jpg', 'carga-fondo.jpg',
  'carga-pc.jpg', 'fondo-movil.jpg'];
// dirección del script de Google; la escribe armar-web.ps1
const SERVIDOR = 'https://script.google.com/macros/s/AKfycbzmECHKjmJVxu1VdJ6Qxx7VGpRKigCETudDzRpq7JkmQsP-D2hKrjV0cHH3Ok-GF3JE4w/exec';

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

// Archivos de la app: siempre se piden primero a internet (así un cambio publicado se ve al abrir) y, si no hay
// conexión, se usa la última copia guardada. Las llamadas al servidor de Google (guardar, consultar) nunca se
// guardan aquí: esas las maneja la propia app.
self.addEventListener('fetch', e => {
  const pedido = e.request;
  if (pedido.method !== 'GET' || new URL(pedido.url).origin !== self.location.origin) return;
  // 'no-cache' obliga a preguntarle al servidor si hay versión nueva. Sin esto el navegador reutilizaba
  // su propia copia hasta 10 minutos (lo que indica GitHub) y un cambio recién publicado no se veía.
  e.respondWith(
    fetch(pedido, { cache: 'no-cache' })
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

// Avisos. El servidor manda un "toque" vacío; aquí se le piden los mensajes pendientes de este aparato
// y se muestran. Si no se pueden traer (sin señal, servidor lento), sale un aviso genérico: el navegador
// exige mostrar algo por cada toque.
async function mostrarAvisos() {
  let lista = [];
  try {
    const sus = await self.registration.pushManager.getSubscription();
    if (sus) {
      const r = await fetch(SERVIDOR, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ fn: 'novedades', args: [sus.endpoint] }),
      });
      const j = await r.json();
      if (j.ok && Array.isArray(j.data)) lista = j.data;
    }
  } catch (e) { /* se muestra el genérico */ }
  if (!lista.length) lista = [{ t: 'Órdenes de Producción', c: 'Hay novedades en las órdenes.', id: '' }];
  await Promise.all(lista.map(m => self.registration.showNotification(m.t, {
    body: m.c,
    icon: 'icono-192.png',
    // un aviso por orden: si la misma orden cambia otra vez, el nuevo reemplaza al anterior en vez de apilarse
    tag: m.id || 'ordenes',
    renotify: true,
    data: { id: m.id || '' },
  })));
}
self.addEventListener('push', e => { e.waitUntil(mostrarAvisos()); });

// Al tocar el aviso se abre la app, o se trae al frente si ya estaba abierta.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ventanas => {
      const abierta = ventanas.find(v => v.url.startsWith(self.registration.scope));
      return abierta ? abierta.focus() : self.clients.openWindow('./');
    })
  );
});
