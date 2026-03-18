const CACHE_NAME = 'unch-v1';
const API_CACHE_NAME = 'unch-api-v1';

// Только GET запросы можно кэшировать!
const STATIC_URLS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/manifest.json',
  '/js/config.js',
  '/js/api.js',
  '/js/utils.js',
  '/js/auth.js',
  '/js/app.js',
  '/js/orders.js',
  '/js/reviews.js',
  '/js/bonuses.js',
  '/js/profile.js',
  '/js/admin.js'
];

// Установка - кэшируем только статические файлы
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static files');
        return cache.addAll(STATIC_URLS);
      })
      .then(() => self.skipWaiting())
      .catch(error => {
        console.error('Cache failed (продолжаем установку):', error);
        self.skipWaiting(); // Продолжаем даже если кэш не удался
      })
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

// Перехват запросов - ВАЖНО: кэшируем только GET запросы!
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Игнорируем не-GET запросы (POST, PUT, DELETE)
  if (event.request.method !== 'GET') {
    return;
  }
  
  // API запросы - сначала сеть, потом кэш
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Кэшируем только успешные GET ответы API
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(API_CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
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
          // Обновляем кэш в фоне (только GET)
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
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
          });
      })
  );
});

// Push-уведомления
self.addEventListener('push', event => {
  const data = event.data?.json() || {
    title: 'У Нас Чисто',
    body: 'Новое уведомление'
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: data.data
    })
  );
});

// Клик по уведомлению
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
