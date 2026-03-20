// ==================== МОДУЛЬ АВТОРИЗАЦИИ ====================

// Состояние авторизации
let currentUser = null;
let authToken = null;

// Константы
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

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
                return true;
            }
        } catch (error) {
            console.log('❌ Токен недействителен, требуется вход');
        }
        
        // Токен недействителен - очищаем
        logout();
    }
    
    return false;
}

// ==================== ВХОД ====================

// Вход по телефону
async function login(phone) {
    if (!phone || phone.length < 10) {
        showToast('Введите корректный телефон', 'error');
        return false;
    }
    
    showLoading(true);
    
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
            
            showToast(`Добро пожаловать, ${user.name}!`, 'success');
            console.log('✅ Вход выполнен успешно');
            
            return true;
        } else {
            showToast(response.data.error || 'Ошибка входа', 'error');
            return false;
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Ошибка сети', 'error');
        return false;
    } finally {
        showLoading(false);
    }
}

// Вход через Telegram
async function loginWithTelegram(tgData) {
    showLoading(true);
    
    try {
        const response = await api.post('/api/auth/telegram', tgData);
        
        if (response.ok) {
            const { access_token, user } = response.data;
            
            authToken = access_token;
            currentUser = user;
            
            localStorage.setItem(TOKEN_KEY, access_token);
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            
            updateUserInterface();
            showToast(`Добро пожаловать, ${user.name}!`, 'success');
            
            return true;
        } else {
            showToast(response.data.error || 'Ошибка входа через Telegram', 'error');
            return false;
        }
    } catch (error) {
        console.error('Telegram login error:', error);
        showToast('Ошибка сети', 'error');
        return false;
    } finally {
        showLoading(false);
    }
}

// ==================== РЕГИСТРАЦИЯ ====================

// Регистрация нового пользователя
async function register(userData) {
    const { name, phone, address } = userData;
    
    // Валидация
    if (!name || name.length < 2) {
        showToast('Введите имя (минимум 2 символа)', 'error');
        return false;
    }
    
    if (!phone || phone.length < 10) {
        showToast('Введите корректный телефон', 'error');
        return false;
    }
    
    showLoading(true);
    
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
            showToast('Регистрация успешна!', 'success');
            
            return true;
        } else {
            showToast(response.data.error || 'Ошибка регистрации', 'error');
            return false;
        }
    } catch (error) {
        console.error('Register error:', error);
        showToast('Ошибка сети', 'error');
        return false;
    } finally {
        showLoading(false);
    }
}

// ==================== ВЫХОД ====================

// Выход из системы
async function logout() {
    const confirmed = await showConfirm('Вы уверены, что хотите выйти?');
    
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
        showAuthModal();
        
        showToast('Вы вышли из системы', 'info');
        console.log('👋 Выход выполнен');
    }
}

// ==================== ОБНОВЛЕНИЕ ПРОФИЛЯ ====================

// Обновление данных пользователя
async function updateProfile(field, value) {
    if (!currentUser) return false;
    
    showLoading(true);
    
    try {
        const updateData = {};
        updateData[field] = value;
        
        const response = await api.put('/api/user/update', updateData);
        
        if (response.ok) {
            currentUser[field] = value;
            localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
            updateUserInterface();
            showToast('Данные обновлены', 'success');
            return true;
        } else {
            showToast(response.data.error || 'Ошибка обновления', 'error');
            return false;
        }
    } catch (error) {
        console.error('Update profile error:', error);
        showToast('Ошибка сети', 'error');
        return false;
    } finally {
        showLoading(false);
    }
}

// ==================== ИНТЕРФЕЙС ====================

// Обновление интерфейса после авторизации
function updateUserInterface() {
    const isLoggedIn = currentUser !== null;
    
    // Показываем/скрываем элементы для авторизованных пользователей
    document.querySelectorAll('.auth-required').forEach(el => {
        el.style.display = isLoggedIn ? 'block' : 'none';
    });
    
    document.querySelectorAll('.guest-only').forEach(el => {
        el.style.display = isLoggedIn ? 'none' : 'block';
    });
    
    // Обновляем информацию о пользователе
    if (isLoggedIn) {
        const userNameEl = document.getElementById('userName');
        const userIdEl = document.getElementById('userId');
        const bonusBadge = document.getElementById('bonusBadge');
        
        if (userNameEl) userNameEl.textContent = currentUser.name;
        if (userIdEl) userIdEl.textContent = `ID: ${currentUser.short_id || '---'}`;
        if (bonusBadge) bonusBadge.textContent = `${currentUser.bonus_balance || 0}💎`;
        
        // Показываем админ-панель для администратора
        if (currentUser.user_id === CONFIG?.ADMIN_ID) {
            document.querySelectorAll('.admin-only').forEach(el => {
                el.style.display = 'block';
            });
        }
    }
}

// ==================== МОДАЛЬНЫЕ ОКНА ====================

// Показ модального окна входа
function showAuthModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'authModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3 class="modal-title">Вход в систему</h3>
                <button class="modal-close" onclick="closeModal('authModal')">&times;</button>
            </div>
            <div class="modal-body">
                <!-- Telegram вход -->
                <div id="telegramLoginWidget" style="margin-bottom: 20px;"></div>
                
                <div style="text-align: center; margin: 15px 0; color: #999;">или</div>
                
                <!-- Вход по телефону -->
                <div class="form-group">
                    <label class="form-label">Телефон</label>
                    <input type="tel" class="form-input" id="loginPhone" placeholder="+7 (999) 123-45-67">
                </div>
                <button class="btn btn-primary" onclick="handleLogin()">Войти</button>
                <button class="btn btn-secondary" onclick="showRegisterModal()">Зарегистрироваться</button>
            </div>
        </div>
    `;
    
    document.getElementById('modalContainer').appendChild(modal);
    
    // Инициализируем виджет Telegram (если есть токен)
    if (CONFIG?.TELEGRAM_BOT_USERNAME) {
        const widget = document.getElementById('telegramLoginWidget');
        widget.innerHTML = `
            <script async src="https://telegram.org/js/telegram-widget.js?22"
                data-telegram-login="${CONFIG.TELEGRAM_BOT_USERNAME}"
                data-size="large"
                data-radius="10"
                data-auth-url="${window.location.origin}/api/auth/telegram/callback"
                data-request-access="write"></script>
        `;
    }
}

// Показ модального окна регистрации
function showRegisterModal() {
    closeModal('authModal');
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'registerModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3 class="modal-title">Регистрация</h3>
                <button class="modal-close" onclick="closeModal('registerModal')">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Имя *</label>
                    <input type="text" class="form-input" id="regName" placeholder="Ваше имя" autocomplete="name">
                </div>
                <div class="form-group">
                    <label class="form-label">Телефон *</label>
                    <input type="tel" class="form-input" id="regPhone" placeholder="+7 (999) 123-45-67" autocomplete="tel">
                </div>
                <div class="form-group">
                    <label class="form-label">Адрес</label>
                    <input type="text" class="form-input" id="regAddress" placeholder="Ваш адрес" autocomplete="address">
                </div>
                <button class="btn btn-primary" onclick="handleRegister()">Зарегистрироваться</button>
            </div>
        </div>
    `;
    
    document.getElementById('modalContainer').appendChild(modal);
}

// Обработчик входа
async function handleLogin() {
    const phone = document.getElementById('loginPhone').value;
    const success = await login(phone);
    
    if (success) {
        closeModal('authModal');
        if (typeof loadPage === 'function') {
            loadPage('main');
        }
    }
}

// Обработчик регистрации
async function handleRegister() {
    const name = document.getElementById('regName').value;
    const phone = document.getElementById('regPhone').value;
    const address = document.getElementById('regAddress').value;
    
    const success = await register({ name, phone, address });
    
    if (success) {
        closeModal('registerModal');
        if (typeof loadPage === 'function') {
            loadPage('main');
        }
    }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

// Закрытие модального окна
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.remove();
}

// Показ загрузчика
function showLoading(show) {
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

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
    return !!getCurrentUser();
}

// Проверка, является ли пользователь админом
function isAdmin() {
    const user = getCurrentUser();
    return user && user.user_id === CONFIG?.ADMIN_ID;
}

// Экспортируем функции
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
