// ==================== МОДУЛЬ АВТОРИЗАЦИИ ====================

// Состояние авторизации
let currentUser = null;
let authToken = null;

// Константы
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

// Показ уведомления (временно, пока нет глобального)
function showToastMessage(message, type = 'info') {
    console.log(`[${type}] ${message}`);
    // Если есть глобальная showToast - используем её
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        alert(message);
    }
}

// Показ подтверждения
function showConfirmMessage(message) {
    return new Promise((resolve) => {
        // Если есть глобальная showConfirm - используем её
        if (typeof window.showConfirm === 'function') {
            resolve(window.showConfirm(message));
        } else {
            resolve(confirm(message));
        }
    });
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

// Проверка авторизации при загрузке
async function initAuth() {
    console.log('🔐 Инициализация авторизации...');
    
    // Проверяем сохраненный токен
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    
    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        
        // Проверяем валидность токена на сервере
        try {
            const response = await api.get('/api/user/me');
            if (response.ok) {
                currentUser = response.data;
                localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
                console.log('✅ Авторизация восстановлена');
                updateUserInterface();
                return true;
            } else if (response.status === 401) {
                console.log('❌ Токен недействителен');
                logout();
                return false;
            }
        } catch (error) {
            console.log('❌ Ошибка проверки токена:', error);
            logout();
            return false;
        }
    }
    
    return false;
}

// ==================== ВХОД ====================

// Вход по телефону
async function login(phone) {
    if (!phone || phone.length < 10) {
        showToastMessage('Введите корректный телефон', 'error');
        return false;
    }
    
    try {
        const response = await api.post('/api/auth/login', { phone });
        
        if (response.ok) {
            const { access_token, user } = response.data;
            
            // Сохраняем данные
            authToken = access_token;
            currentUser = user;
            
            localStorage.setItem(TOKEN_KEY, access_token);
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            
            // Обновляем интерфейс
            updateUserInterface();
            
            showToastMessage(`Добро пожаловать, ${user.name}!`, 'success');
            console.log('✅ Вход выполнен успешно');
            
            return true;
        } else {
            showToastMessage(response.data.error || 'Ошибка входа', 'error');
            return false;
        }
    } catch (error) {
        console.error('Login error:', error);
        showToastMessage('Ошибка сети', 'error');
        return false;
    }
}

// Вход через Telegram
async function loginWithTelegram(tgData) {
    try {
        const response = await api.post('/api/auth/telegram', tgData);
        
        if (response.ok) {
            const { access_token, user } = response.data;
            
            authToken = access_token;
            currentUser = user;
            
            localStorage.setItem(TOKEN_KEY, access_token);
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            
            updateUserInterface();
            showToastMessage(`Добро пожаловать, ${user.name}!`, 'success');
            
            return true;
        } else {
            showToastMessage(response.data.error || 'Ошибка входа через Telegram', 'error');
            return false;
        }
    } catch (error) {
        console.error('Telegram login error:', error);
        showToastMessage('Ошибка сети', 'error');
        return false;
    }
}

// ==================== РЕГИСТРАЦИЯ ====================

// Регистрация нового пользователя
async function register(userData) {
    const { name, phone, address } = userData;
    
    // Валидация
    if (!name || name.length < 2) {
        showToastMessage('Введите имя (минимум 2 символа)', 'error');
        return false;
    }
    
    if (!phone || phone.length < 10) {
        showToastMessage('Введите корректный телефон', 'error');
        return false;
    }
    
    try {
        const response = await api.post('/api/auth/register', {
            name: name.trim(),
            phone: phone.trim(),
            address: address?.trim() || ''
        });
        
        if (response.ok) {
            const { access_token, user } = response.data;
            
            authToken = access_token;
            currentUser = user;
            
            localStorage.setItem(TOKEN_KEY, access_token);
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            
            updateUserInterface();
            showToastMessage('Регистрация успешна!', 'success');
            
            return true;
        } else {
            showToastMessage(response.data.error || 'Ошибка регистрации', 'error');
            return false;
        }
    } catch (error) {
        console.error('Register error:', error);
        showToastMessage('Ошибка сети', 'error');
        return false;
    }
}

// ==================== ВЫХОД ====================

// Выход из системы
async function logout() {
    const confirmed = await showConfirmMessage('Вы уверены, что хотите выйти?');
    
    if (confirmed) {
        // Очищаем локальные данные
        authToken = null;
        currentUser = null;
        
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        
        // Очищаем API кэш
        if (window.api && api.clearCache) {
            api.clearCache();
        }
        
        // Обновляем интерфейс
        updateUserInterface();
        
        // Показываем форму входа
        if (typeof showAuthModal === 'function') {
            showAuthModal();
        }
        
        showToastMessage('Вы вышли из системы', 'info');
        console.log('👋 Выход выполнен');
        
        // Перезагружаем страницу для очистки состояния
        window.location.reload();
    }
}

// ==================== ОБНОВЛЕНИЕ ПРОФИЛЯ ====================

// Обновление данных пользователя
async function updateProfile(field, value) {
    if (!currentUser) return false;
    
    try {
        const updateData = {};
        updateData[field] = value;
        
        const response = await api.put('/api/user/update', updateData);
        
        if (response.ok) {
            currentUser[field] = value;
            localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
            updateUserInterface();
            showToastMessage('Данные обновлены', 'success');
            return true;
        } else {
            showToastMessage(response.data.error || 'Ошибка обновления', 'error');
            return false;
        }
    } catch (error) {
        console.error('Update profile error:', error);
        showToastMessage('Ошибка сети', 'error');
        return false;
    }
}

// ==================== ИНТЕРФЕЙС ====================

// Обновление интерфейса после авторизации
function updateUserInterface() {
    const isLoggedIn = currentUser !== null;
    
    // Показываем/скрываем элементы для авторизованных пользователей
    document.querySelectorAll('.auth-required').forEach(el => {
        if (el) el.style.display = isLoggedIn ? 'block' : 'none';
    });
    
    document.querySelectorAll('.guest-only').forEach(el => {
        if (el) el.style.display = isLoggedIn ? 'none' : 'block';
    });
    
    // Обновляем информацию о пользователе
    if (isLoggedIn && currentUser) {
        const userNameEl = document.getElementById('userName');
        const userIdEl = document.getElementById('userId');
        const bonusBadge = document.getElementById('bonusBadge');
        
        if (userNameEl) userNameEl.textContent = currentUser.name || 'Пользователь';
        if (userIdEl) userIdEl.textContent = `ID: ${currentUser.short_id || '---'}`;
        if (bonusBadge) bonusBadge.textContent = `${currentUser.bonus_balance || 0}💎`;
        
        // Показываем админ-панель для администратора
        const adminId = window.CONFIG?.ADMIN_ID || '1209283843';
        if (currentUser.user_id === adminId) {
            document.querySelectorAll('.admin-only').forEach(el => {
                if (el) el.style.display = 'block';
            });
        }
    }
}

// ==================== ГЕТТЕРЫ ====================

// Получение текущего токена
function getAuthToken() {
    return authToken || localStorage.getItem(TOKEN_KEY);
}

// Получение текущего пользователя
function getCurrentUser() {
    return currentUser || JSON.parse(localStorage.getItem(USER_KEY) || 'null');
}

// Проверка, авторизован ли пользователь
function isAuthenticated() {
    return !!getCurrentUser() && !!getAuthToken();
}

// Проверка, является ли пользователь админом
function isAdmin() {
    const user = getCurrentUser();
    const adminId = window.CONFIG?.ADMIN_ID || '1209283843';
    return user && user.user_id === adminId;
}

// ==================== ЭКСПОРТ ====================

// Экспортируем функции в глобальный объект
window.auth = {
    init: initAuth,
    login,
    loginWithTelegram,
    register,
    logout,
    updateProfile,
    getCurrentUser,
    isAuthenticated,
    isAdmin,
    getToken: getAuthToken
};

console.log('🔐 Модуль авторизации загружен');
