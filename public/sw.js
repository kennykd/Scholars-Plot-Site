self.addEventListener('push', function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.error('Error parsing push data:', e);
    data = { body: event.data?.text() };
  }

  const title = data.title || 'Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.ico',
    tag: data.tag || data.data?.url || title,
    renotify: false,
    data: data.data || {},
  };

  const broadcastPayload = {
    title,
    body: options.body,
    tag: options.tag,
    data: options.data,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options).catch(err => {
        console.error('Failed to show notification:', err);
      }),
      clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((windowClients) => {
          windowClients.forEach((client) => {
            client.postMessage({
              type: 'WEB_PUSH_NOTIFICATION_RECEIVED',
              notification: broadcastPayload,
            });
          });
        }),
    ])
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});

/* Keep the worker alive for functional events */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
});
