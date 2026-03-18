// Расширенный API клиент с обработкой ошибок и кэшированием
const api = {
    baseUrl: CONFIG.API_URL,
    cache: new Map(),
    
    async request(endpoint, options = {}) {
        const url = this.baseUrl + endpoint;
        const token = localStorage.getItem('token');
        
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
        if (options.method === 'GET' && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 60000) { // 1 минута
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
            
            // Кэшируем успешные GET запросы
            if (response.ok && options.method === 'GET') {
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
                console.log('Returning cached data');
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
        this.invalidateCache(endpoint); // Инвалидируем кэш при POST
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
    },
    
    // Загрузка файла
    upload(endpoint, file, onProgress) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    onProgress(Math.round((e.loaded * 100) / e.total));
                }
            });
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch {
                        resolve(xhr.responseText);
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.status}`));
                }
            });
            
            xhr.addEventListener('error', () => reject(new Error('Upload failed')));
            
            xhr.open('POST', this.baseUrl + endpoint);
            xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
            xhr.send(formData);
        });
    }
};
