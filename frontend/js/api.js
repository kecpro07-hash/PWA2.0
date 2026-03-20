// Расширенный API клиент с обработкой ошибок и кэшированием
const api = {
    baseUrl: window.location.origin,
    cache: new Map(),
    
    // Получение токена
    getToken() {
        return localStorage.getItem('auth_token');
    },
    
    async request(endpoint, options = {}) {
        const url = this.baseUrl + endpoint;
        const token = this.getToken();
        
        const headers = {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Кэширование GET запросов
        const cacheKey = url + JSON.stringify(options);
        const isGetRequest = options.method === 'GET' || !options.method;
        
        if (isGetRequest && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 60000) { // 1 минута
                console.log(`📦 Cache hit: ${endpoint}`);
                return cached.data;
            }
            this.cache.delete(cacheKey);
        }
        
        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include'
            });
            
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }
            
            const result = {
                ok: response.ok,
                status: response.status,
                statusText: response.statusText,
                data,
                headers: response.headers
            };
            
            // При 401 - очищаем токен
            if (response.status === 401) {
                console.log('🔒 401 Unauthorized - очищаем токен');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_data');
                
                // Если есть функция для показа входа - вызываем
                if (typeof window.showAuthModal === 'function') {
                    window.showAuthModal();
                }
            }
            
            // Кэшируем успешные GET запросы
            if (response.ok && isGetRequest) {
                this.cache.set(cacheKey, {
                    timestamp: Date.now(),
                    data: result
                });
            }
            
            return result;
            
        } catch (error) {
            console.error('API Error:', error);
            
            // Пытаемся получить из кэша при ошибке сети
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                console.log('📦 Network error, returning cached data');
                return cached.data;
            }
            
            return {
                ok: false,
                status: 0,
                error: error.message,
                data: { error: 'Network error' }
            };
        }
    },
    
    // Очистка кэша
    clearCache() {
        this.cache.clear();
    },
    
    // Удалить из кэша по префиксу
    invalidateCache(prefix) {
        for (const [key] of this.cache) {
            if (key.includes(prefix)) {
                this.cache.delete(key);
            }
        }
    },
    
    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },
    
    post(endpoint, body) {
        this.invalidateCache(endpoint);
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },
    
    put(endpoint, body) {
        this.invalidateCache(endpoint);
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    },
    
    delete(endpoint) {
        this.invalidateCache(endpoint);
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
};

// Делаем api глобальным
window.api = api;

console.log('🌐 API клиент загружен');
