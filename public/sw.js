const CACHE_NAME = 'alarm-clock-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.jpg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Pre-cache warning (some assets might be dynamically generated):', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cache-First or Network Fallback fetch strategy for flawless offline operation
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and local assets
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache (stale-while-revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Ignore network errors offline */});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // If offline and request fails, fallback to index.html for SPA routes
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Alarms state within the Service Worker
let scheduledAlarms = [];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_ALARMS') {
    scheduledAlarms = event.data.alarms || [];
  }
});

// A background interval that attempts to check active alarms.
// This is triggered in the background even if the main window is closed.
setInterval(() => {
  if (scheduledAlarms.length === 0) return;

  const now = new Date();
  const hoursStr = String(now.getHours()).padStart(2, '0');
  const minutesStr = String(now.getMinutes()).padStart(2, '0');
  const currentDay = now.getDay();
  const currentTimeStr = `${hoursStr}:${minutesStr}`;

  scheduledAlarms.forEach((alarm) => {
    if (!alarm.enabled) return;

    // Check day recurrence
    const isDayMatch = alarm.days.length === 0 || alarm.days.includes(currentDay);
    if (isDayMatch && alarm.time === currentTimeStr) {
      // Avoid duplicate triggers in the same minute
      const lastTriggeredKey = `triggered-${alarm.id}-${currentTimeStr}`;
      if (self[lastTriggeredKey]) return;
      self[lastTriggeredKey] = true;

      // Clean up old keys
      setTimeout(() => {
        delete self[lastTriggeredKey];
      }, 61000);

      self.registration.showNotification(alarm.label || 'Будильник', {
        body: `Время ${alarm.time}! Нажмите, чтобы открыть будильник.`,
        requireInteraction: true,
        tag: alarm.id,
        vibrate: [300, 100, 300, 100, 300, 100, 300],
        icon: '/icon.jpg',
        badge: '/icon.jpg',
        actions: [
          { action: 'open', title: 'Открыть будильник' }
        ]
      });
    }
  });
}, 20000);

// Handle clicking on the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new tab at root
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
