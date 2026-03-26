// ==================== МОДУЛЬ АВТОРИЗАЦИИ С ПАРОЛЕМ ====================

// Состояние авторизации
let currentUser = null;
let authToken = null;

// Константы
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

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

async function login(phone, password) {
    if (!phone || phone.length < 10) {
        showToast('Введите корректный телефон', 'error');
        return false;
    }
    
    if (!password || password.length < 4) {
        showToast('Введите пароль (минимум 4 символа)', 'error');
        return false;
    }
    
    try {
        const response = await api.post('/api/auth/login', { phone, password });
        
        if (response.ok) {
            const { access_token, user } = response.data;
            
            authToken = access_token;
            currentUser = user;
            
            localStorage.setItem(TOKEN_KEY, access_token);
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            
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
    }
}

// ==================== РЕГИСТРАЦИЯ ====================

async function register(userData) {
    const { name, phone, password, confirmPassword, address } = userData;
    
    if (!name || name.length < 2) {
        showToast('Введите имя (минимум 2 символа)', 'error');
        return false;
    }
    
    if (!phone || phone.length < 10) {
        showToast('Введите корректный телефон', 'error');
        return false;
    }
    
    if (!password || password.length < 4) {
        showToast('Пароль должен быть не менее 4 символов', 'error');
        return false;
    }
    
    if (password !== confirmPassword) {
        showToast('Пароли не совпадают', 'error');
        return false;
    }
    
    try {
        const response = await api.post('/api/auth/register', {
            name: name.trim(),
            phone: phone.trim(),
            password: password,
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
    }
}

// ==================== СМЕНА ПАРОЛЯ ====================

async function changePassword(oldPassword, newPassword, confirmPassword) {
    if (!oldPassword) {
        showToast('Введите старый пароль', 'error');
        return false;
    }
    
    if (!newPassword || newPassword.length < 4) {
        showToast('Новый пароль должен быть не менее 4 символов', 'error');
        return false;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('Пароли не совпадают', 'error');
        return false;
    }
    
    try {
        const response = await api.post('/api/user/change-password', {
            old_password: oldPassword,
            new_password: newPassword
        });
        
        if (response.ok) {
            showToast('Пароль успешно изменен!', 'success');
            return true;
        } else {
            showToast(response.data.error || 'Ошибка смены пароля', 'error');
            return false;
        }
    } catch (error) {
        console.error('Change password error:', error);
        showToast('Ошибка сети', 'error');
        return false;
    }
}

// ==================== ВОССТАНОВЛЕНИЕ ПАРОЛЯ ====================

async function requestPasswordReset(phone) {
    if (!phone || phone.length < 10) {
        showToast('Введите корректный телефон', 'error');
        return false;
    }
    
    try {
        const response = await api.post('/api/auth/reset-password', { phone });
        
        if (response.ok) {
            showToast('Код восстановления отправлен!', 'success');
            return response.data.reset_code;
        } else {
            showToast(response.data.error || 'Ошибка', 'error');
            return false;
        }
    } catch (error) {
        console.error('Reset password error:', error);
        showToast('Ошибка сети', 'error');
        return false;
    }
}

async function confirmPasswordReset(phone, code, newPassword) {
    if (!code || code.length !== 6) {
        showToast('Введите корректный код', 'error');
        return false;
    }
    
    if (!newPassword || newPassword.length < 4) {
        showToast('Пароль должен быть не менее 4 символов', 'error');
        return false;
    }
    
    try {
        const response = await api.post('/api/auth/confirm-reset', {
            phone,
            code,
            new_password: newPassword
        });
        
        if (response.ok) {
            showToast('Пароль успешно изменен!', 'success');
            return true;
        } else {
            showToast(response.data.error || 'Ошибка', 'error');
            return false;
        }
    } catch (error) {
        console.error('Confirm reset error:', error);
        showToast('Ошибка сети', 'error');
        return false;
    }
}

// ==================== ВЫХОД ====================

async function logout() {
    const confirmed = await showConfirm('Вы уверены, что хотите выйти?');
    
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
        showToast('Вы вышли из системы', 'info');
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
        
        const adminId = window.CONFIG?.ADMIN_ID || '';
        if (currentUser.user_id === adminId) {
            document.querySelectorAll('.admin-only').forEach(el => {
                if (el) el.style.display = 'block';
            });
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
    const adminId = window.CONFIG?.ADMIN_ID || '';
    return user && user.user_id === adminId;
}

// ==================== МОДАЛЬНЫЕ ОКНА ====================

function showAuthModal() {
    const existingModal = document.getElementById('authModal');
    if (existingModal) existingModal.remove();
    
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
                <div class="form-group">
                    <label class="form-label">Пароль</label>
                    <input type="password" class="form-input" id="loginPassword" placeholder="Введите пароль">
                </div>
                <button class="btn btn-primary" onclick="window.handleLogin()">Войти</button>
                <div style="text-align: center; margin: 10px 0;">
                    <a href="#" onclick="window.showForgotPasswordModal(); return false;" style="color: #FF8C00; text-decoration: none;">Забыли пароль?</a>
                </div>
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
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    
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
                    <label class="form-label">Пароль *</label>
                    <input type="password" class="form-input" id="regPassword" placeholder="Минимум 4 символа">
                </div>
                <div class="form-group">
                    <label class="form-label">Подтвердите пароль *</label>
                    <input type="password" class="form-input" id="regConfirmPassword" placeholder="Повторите пароль">
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
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    
    setTimeout(() => {
        const nameInput = modal.querySelector('#regName');
        if (nameInput) nameInput.focus();
    }, 100);
}

function showForgotPasswordModal() {
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.remove();
    
    let resetPhone = '';
    let resetCode = '';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'forgotModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3 class="modal-title">Восстановление пароля</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body" id="forgotBody">
                <div id="stepPhone">
                    <div class="form-group">
                        <label class="form-label">Телефон</label>
                        <input type="tel" class="form-input" id="resetPhone" placeholder="+7 (999) 123-45-67">
                    </div>
                    <button class="btn btn-primary" id="sendCodeBtn">Отправить код</button>
                    <button class="btn btn-secondary" onclick="window.showAuthModal()">Назад</button>
                </div>
                <div id="stepCode" style="display: none;">
                    <div class="form-group">
                        <label class="form-label">Код из SMS</label>
                        <input type="text" class="form-input" id="resetCodeInput" placeholder="6-значный код" maxlength="6">
                    </div>
                    <button class="btn btn-primary" id="verifyCodeBtn">Подтвердить</button>
                    <button class="btn btn-secondary" onclick="window.showAuthModal()">Назад</button>
                </div>
                <div id="stepPassword" style="display: none;">
                    <div class="form-group">
                        <label class="form-label">Новый пароль</label>
                        <input type="password" class="form-input" id="newPassword" placeholder="Минимум 4 символа">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Подтвердите пароль</label>
                        <input type="password" class="form-input" id="confirmNewPassword" placeholder="Повторите пароль">
                    </div>
                    <button class="btn btn-primary" id="resetPasswordBtn">Сменить пароль</button>
                    <button class="btn btn-secondary" onclick="window.showAuthModal()">Назад</button>
                </div>
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
    
    // Шаг 1: Отправка кода
    modal.querySelector('#sendCodeBtn').addEventListener('click', async () => {
        const phone = modal.querySelector('#resetPhone').value;
        if (!phone || phone.length < 10) {
            showToast('Введите корректный телефон', 'error');
            return;
        }
        
        resetPhone = phone;
        const result = await window.auth.requestPasswordReset(phone);
        
        if (result) {
            modal.querySelector('#stepPhone').style.display = 'none';
            modal.querySelector('#stepCode').style.display = 'block';
            showToast('Код отправлен!', 'success');
        }
    });
    
    // Шаг 2: Проверка кода
    modal.querySelector('#verifyCodeBtn').addEventListener('click', () => {
        const code = modal.querySelector('#resetCodeInput').value;
        if (!code || code.length !== 6) {
            showToast('Введите 6-значный код', 'error');
            return;
        }
        
        resetCode = code;
        modal.querySelector('#stepCode').style.display = 'none';
        modal.querySelector('#stepPassword').style.display = 'block';
    });
    
    // Шаг 3: Смена пароля
    modal.querySelector('#resetPasswordBtn').addEventListener('click', async () => {
        const newPassword = modal.querySelector('#newPassword').value;
        const confirmPassword = modal.querySelector('#confirmNewPassword').value;
        
        if (!newPassword || newPassword.length < 4) {
            showToast('Пароль должен быть не менее 4 символов', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showToast('Пароли не совпадают', 'error');
            return;
        }
        
        const success = await window.auth.confirmPasswordReset(resetPhone, resetCode, newPassword);
        
        if (success) {
            modal.remove();
            showAuthModal();
            showToast('Пароль изменен! Войдите с новым паролем', 'success');
        }
    });
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function showChangePasswordModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3 class="modal-title">Смена пароля</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Старый пароль</label>
                    <input type="password" class="form-input" id="oldPassword" placeholder="Введите старый пароль">
                </div>
                <div class="form-group">
                    <label class="form-label">Новый пароль</label>
                    <input type="password" class="form-input" id="newPassword" placeholder="Минимум 4 символа">
                </div>
                <div class="form-group">
                    <label class="form-label">Подтвердите пароль</label>
                    <input type="password" class="form-input" id="confirmNewPassword" placeholder="Повторите пароль">
                </div>
                <button class="btn btn-primary" id="changePasswordBtn">Сменить пароль</button>
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
    
    modal.querySelector('#changePasswordBtn').addEventListener('click', async () => {
        const oldPassword = modal.querySelector('#oldPassword').value;
        const newPassword = modal.querySelector('#newPassword').value;
        const confirmPassword = modal.querySelector('#confirmNewPassword').value;
        
        const success = await window.auth.changePassword(oldPassword, newPassword, confirmPassword);
        
        if (success) {
            modal.remove();
        }
    });
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
}

// ==================== ОБРАБОТЧИКИ ====================

window.handleLogin = async function() {
    const phone = document.getElementById('loginPhone')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    const success = await window.auth.login(phone, password);
    
    if (success) {
        const modal = document.getElementById('authModal');
        if (modal) modal.remove();
        if (typeof loadPage === 'function') loadPage('main');
        else window.location.reload();
    }
};

window.handleRegister = async function() {
    const name = document.getElementById('regName')?.value;
    const phone = document.getElementById('regPhone')?.value;
    const password = document.getElementById('regPassword')?.value;
    const confirmPassword = document.getElementById('regConfirmPassword')?.value;
    const address = document.getElementById('regAddress')?.value;
    
    const success = await window.auth.register({
        name, phone, password, confirmPassword, address
    });
    
    if (success) {
        const modal = document.getElementById('registerModal');
        if (modal) modal.remove();
        if (typeof loadPage === 'function') loadPage('main');
        else window.location.reload();
    }
};

// ==================== ЭКСПОРТ ====================

window.auth = {
    init: initAuth,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    requestPasswordReset,
    confirmPasswordReset,
    getCurrentUser,
    isAuthenticated,
    isAdmin,
    getToken: getAuthToken
};

window.showAuthModal = showAuthModal;
window.showRegisterModal = showRegisterModal;
window.showForgotPasswordModal = showForgotPasswordModal;
window.showChangePasswordModal = showChangePasswordModal;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;

console.log('🔐 Модуль авторизации загружен');
