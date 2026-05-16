self.addEventListener('push', function (event) {
  console.log('Push event received:', event);
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
    console.log('Parsed push data:', data);
  } catch (e) {
    console.error('Error parsing push data:', e);
    data = { body: event.data?.text() };
  }

  const title = data.title || 'Notification';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.ico',
    data: data.data || {},
  };

  console.log('Showing notification:', title, options);
  event.waitUntil(
    self.registration.showNotification(title, options).catch(err => {
      console.error('Failed to show notification:', err);
    })
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
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});
