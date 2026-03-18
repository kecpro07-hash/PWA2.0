const CACHE_NAME = 'unch-v1';
const API_CACHE_NAME = 'unch-api-v1';

// Список файлов для кэширования - УБЕДИТЕСЬ, ЧТО ВСЕ ФАЙЛЫ СУЩЕСТВУЮТ!
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

// Опциональные файлы (иконки) - если их нет, не будем ломать кэш
const OPTIONAL_URLS = [
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/favicon.ico'
];

// Установка - кэшируем только существующие файлы
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        console.log('Caching static files');
        
        // Кэшируем основные файлы по одному с проверкой
        const results = await Promise.allSettled(
          STATIC_URLS.map(async url => {
            try {
              const response = await fetch(url);
              if (response.ok) {
                await cache.put(url, response);
                console.log(`✅ Cached: ${url}`);
              } else {
                console.warn(`⚠️ Failed to fetch ${url}: ${response.status}`);
              }
            } catch (error) {
              console.warn(`⚠️ Error caching ${url}:`, error.message);
            }
          })
        );
        
        console.log(`Cached ${results.filter(r => r.status === 'fulfilled').length} files`);
        
        // Пробуем кэшировать опциональные файлы (игнорируем ошибки)
        await Promise.allSettled(
          OPTIONAL_URLS.map(async url => {
            try {
              const response = await fetch(url);
              if (response.ok) {
                await cache.put(url, response);
                console.log(`✅ Cached optional: ${url}`);
              }
            } catch (error) {
              // Игнорируем ошибки для опциональных файлов
            }
          })
        );
        
        return self.skipWaiting();
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

// Стратегия кэширования: Stale-While-Revalidate для статики
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Игнорируем запросы не к нашему домену
  if (url.origin !== self.location.origin) {
    return;
  }
  
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
            // Если нет сети и нет кэша - показываем заглушку для HTML
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
