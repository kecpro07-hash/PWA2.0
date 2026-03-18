const CACHE_NAME = 'unch-v1';
const API_CACHE_NAME = 'unch-api-v1';

const STATIC_URLS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

const API_URLS = [
  '/api/reviews',
  '/api/health'
];

// Установка - кэшируем статику
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static files');
        return cache.addAll(STATIC_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Активация - удаляем старые кэши
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Стратегия кэширования: Stale-While-Revalidate для статики
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // API запросы - сначала сеть, если нет сети - кэш
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Кэшируем успешные ответы API
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(API_CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Если нет сети - возвращаем из кэша
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Статика - сначала кэш, потом сеть
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Обновляем кэш в фоне
          fetch(event.request)
            .then(response => {
              if (response.status === 200) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, responseToCache);
                });
              }
            })
            .catch(() => {});
          
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(response => {
            if (response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
            return response;
          })
          .catch(() => {
            // Если нет сети и нет кэша - показываем заглушку
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
          });
      })
  );
});

// Обработка push-уведомлений
self.addEventListener('push', event => {
  console.log('Push received:', event);
  
  let data = {};
  
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'У Нас Чисто',
      body: event.data.text(),
      icon: '/icons/icon-192x192.png'
    };
  }
  
  const options = {
    body: data.body || 'Новое уведомление',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [
      {
        action: 'open',
        title: 'Открыть'
      },
      {
        action: 'close',
        title: 'Закрыть'
      }
    ],
    tag: data.tag || 'default',
    renotify: true,
    requireInteraction: false
  };
  
  event.waitUntil(
    self.registration.showNotification(
      data.title || 'У Нас Чисто',
      options
    )
  );
});

// Клик по уведомлению
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then(windowClients => {
      // Если уже есть открытое окно - фокусируем его
      for (let client of windowClients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          client.focus();
          if (urlToOpen !== '/') {
            client.navigate(urlToOpen);
          }
          return;
        }
      }
      // Иначе открываем новое
      return clients.openWindow(urlToOpen);
    })
  );
});

// Обработка синхронизации в фоне
self.addEventListener('sync', event => {
  console.log('Sync event:', event.tag);
  
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
  
  if (event.tag === 'sync-reviews') {
    event.waitUntil(syncReviews());
  }
});

// Функции для фоновой синхронизации
async function syncOrders() {
  console.log('Syncing orders...');
  // Здесь будет логика синхронизации заказов
}

async function syncReviews() {
  console.log('Syncing reviews...');
  // Здесь будет логика синхронизации отзывов
}
