// ==================== МОДУЛЬ АВТОРИЗАЦИИ ====================

// Состояние авторизации
let currentUser = null;
let authToken = null;

// Константы
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

// Показ уведомления (если нет глобальной)
function showToastMessage(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        console.log(`[${type}] ${message}`);
        alert(message);
    }
}

// Показ подтверждения (если нет глобальной)
async function showConfirmMessage(message) {
    if (typeof window.showConfirm === 'function') {
        return await window.showConfirm(message);
    } else {
        return confirm(message);
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

async function initAuth() {
    console.log('🔐 Инициализация авторизации...');
    
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    
    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        
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

async function login(phone) {
    if (!phone || phone.length < 10) {
        showToastMessage('Введите корректный телефон', 'error');
        return false;
    }
    
    try {
        const response = await api.post('/api/auth/login', { phone });
        
        if (response.ok) {
            const { access_token, user } = response.data;
            
            authToken = access_token;
            currentUser = user;
            
            localStorage.setItem(TOKEN_KEY, access_token);
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            
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

async function register(userData) {
    const { name, phone, address } = userData;
    
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

async function logout() {
    const confirmed = await showConfirmMessage('Вы уверены, что хотите выйти?');
    
    if (confirmed) {
        authToken = null;
        currentUser = null;
        
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        
        if (window.api && api.clearCache) {
            api.clearCache();
        }
        
        updateUserInterface();
        
        showAuthModal();
        showToastMessage('Вы вышли из системы', 'info');
        console.log('👋 Выход выполнен');
    }
}

// ==================== ОБНОВЛЕНИЕ ПРОФИЛЯ ====================

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

function updateUserInterface() {
    const isLoggedIn = currentUser !== null;
    
    document.querySelectorAll('.auth-required').forEach(el => {
        if (el) el.style.display = isLoggedIn ? 'block' : 'none';
    });
    
    document.querySelectorAll('.guest-only').forEach(el => {
        if (el) el.style.display = isLoggedIn ? 'none' : 'block';
    });
    
    if (isLoggedIn && currentUser) {
        const userNameEl = document.getElementById('userName');
        const userIdEl = document.getElementById('userId');
        const bonusBadge = document.getElementById('bonusBadge');
        
        if (userNameEl) userNameEl.textContent = currentUser.name || 'Пользователь';
        if (userIdEl) userIdEl.textContent = `ID: ${currentUser.short_id || '---'}`;
        if (bonusBadge) bonusBadge.textContent = `${currentUser.bonus_balance || 0}💎`;
        
        const adminId = window.CONFIG?.ADMIN_ID || '1209283843';
        if (currentUser.user_id === adminId) {
            document.querySelectorAll('.admin-only').forEach(el => {
                if (el) el.style.display = 'block';
            });
        }
    }
}

// ==================== МОДАЛЬНЫЕ ОКНА ====================

function showAuthModal() {
    const existingModal = document.getElementById('authModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'authModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3 class="modal-title">Вход в систему</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Телефон</label>
                    <input type="tel" class="form-input" id="loginPhone" placeholder="+7 (999) 123-45-67">
                </div>
                <button class="btn btn-primary" onclick="window.handleLogin()">Войти</button>
                <button class="btn btn-secondary" onclick="window.showRegisterModal()">Зарегистрироваться</button>
            </div>
        </div>
    `;
    
    let modalContainer = document.getElementById('modalContainer');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'modalContainer';
        document.body.appendChild(modalContainer);
    }
    modalContainer.appendChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    setTimeout(() => {
        const phoneInput = modal.querySelector('#loginPhone');
        if (phoneInput) phoneInput.focus();
    }, 100);
}

function showRegisterModal() {
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'registerModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3 class="modal-title">Регистрация</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Имя *</label>
                    <input type="text" class="form-input" id="regName" placeholder="Ваше имя">
                </div>
                <div class="form-group">
                    <label class="form-label">Телефон *</label>
                    <input type="tel" class="form-input" id="regPhone" placeholder="+7 (999) 123-45-67">
                </div>
                <div class="form-group">
                    <label class="form-label">Адрес</label>
                    <input type="text" class="form-input" id="regAddress" placeholder="Ваш адрес">
                </div>
                <button class="btn btn-primary" onclick="window.handleRegister()">Зарегистрироваться</button>
                <button class="btn btn-secondary" onclick="window.showAuthModal()">Назад</button>
            </div>
        </div>
    `;
    
    let modalContainer = document.getElementById('modalContainer');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'modalContainer';
        document.body.appendChild(modalContainer);
    }
    modalContainer.appendChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    setTimeout(() => {
        const nameInput = modal.querySelector('#regName');
        if (nameInput) nameInput.focus();
    }, 100);
}

// ==================== ОБРАБОТЧИКИ ====================

async function handleLogin() {
    const phoneInput = document.getElementById('loginPhone');
    if (!phoneInput) return;
    
    const phone = phoneInput.value;
    
    if (!phone || phone.length < 10) {
        showToastMessage('Введите корректный телефон', 'error');
        return;
    }
    
    const success = await login(phone);
    
    if (success) {
        const modal = document.getElementById('authModal');
        if (modal) modal.remove();
        
        if (typeof window.loadPage === 'function') {
            window.loadPage('main');
        } else {
            window.location.reload();
        }
    }
}

async function handleRegister() {
    const name = document.getElementById('regName')?.value;
    const phone = document.getElementById('regPhone')?.value;
    const address = document.getElementById('regAddress')?.value;
    
    if (!name || name.length < 2) {
        showToastMessage('Введите имя (минимум 2 символа)', 'error');
        return;
    }
    
    if (!phone || phone.length < 10) {
        showToastMessage('Введите корректный телефон', 'error');
        return;
    }
    
    const success = await register({ name, phone, address });
    
    if (success) {
        const modal = document.getElementById('registerModal');
        if (modal) modal.remove();
        
        if (typeof window.loadPage === 'function') {
            window.loadPage('main');
        } else {
            window.location.reload();
        }
    }
}

// ==================== ГЕТТЕРЫ ====================

function getAuthToken() {
    return authToken || localStorage.getItem(TOKEN_KEY);
}

function getCurrentUser() {
    return currentUser || JSON.parse(localStorage.getItem(USER_KEY) || 'null');
}

function isAuthenticated() {
    return !!getCurrentUser() && !!getAuthToken();
}

function isAdmin() {
    const user = getCurrentUser();
    const adminId = window.CONFIG?.ADMIN_ID || '1209283843';
    return user && user.user_id === adminId;
}

// ==================== ЭКСПОРТ ====================

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

window.showAuthModal = showAuthModal;
window.showRegisterModal = showRegisterModal;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;

console.log('🔐 Модуль авторизации загружен');
