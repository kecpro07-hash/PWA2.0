// Функции авторизации

// Проверка авторизации
async function checkAuth() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        return false;
    }
    
    try {
        const response = await api.get('/api/user/me');
        if (response.ok) {
            window.currentUser = response.data;
            updateUserInfo();
            return true;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
    
    localStorage.removeItem('token');
    return false;
}

// Обновление информации о пользователе в интерфейсе
function updateUserInfo() {
    if (window.currentUser) {
        document.getElementById('userName').textContent = window.currentUser.name || 'Пользователь';
        document.getElementById('userId').textContent = `ID: ${window.currentUser.short_id || '---'}`;
        document.getElementById('bonusBadge').textContent = `${window.currentUser.bonus_balance || 0}💎`;
    }
}

// Вход
async function login() {
    const phone = document.getElementById('loginPhone').value;
    
    if (!phone) {
        showToast('Введите телефон', 'error');
        return;
    }
    
    const response = await api.post('/api/auth/login', { phone });
    
    if (response.ok) {
        localStorage.setItem('token', response.data.access_token);
        window.currentUser = response.data.user;
        updateUserInfo();
        document.getElementById('modalContainer').innerHTML = '';
        loadPage('main');
        showToast('Добро пожаловать!', 'success');
    } else {
        showToast(response.data.error || 'Ошибка входа', 'error');
    }
}

// Регистрация
async function register() {
    const name = document.getElementById('regName').value;
    const phone = document.getElementById('regPhone').value;
    const address = document.getElementById('regAddress').value;
    
    if (!name || !phone) {
        showToast('Заполните все поля', 'error');
        return;
    }
    
    const response = await api.post('/api/auth/register', {
        name, phone, address
    });
    
    if (response.ok) {
        localStorage.setItem('token', response.data.access_token);
        window.currentUser = response.data.user;
        updateUserInfo();
        document.getElementById('modalContainer').innerHTML = '';
        loadPage('main');
        showToast('Регистрация успешна!', 'success');
    } else {
        showToast(response.data.error || 'Ошибка регистрации', 'error');
    }
}

// Выход
async function logout() {
    const confirmed = await showConfirm('Вы уверены, что хотите выйти?');
    if (confirmed) {
        localStorage.removeItem('token');
        window.currentUser = null;
        location.reload();
    }
}

// Показ модального окна входа
function showAuthModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Вход в систему</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Телефон</label>
                    <input type="tel" class="form-input" id="loginPhone" placeholder="+7 (999) 123-45-67">
                </div>
                <button class="btn btn-primary" onclick="login()">Войти</button>
                <button class="btn btn-secondary" onclick="showRegisterModal()">Зарегистрироваться</button>
            </div>
        </div>
    `;
    
    document.getElementById('modalContainer').appendChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
}

// Показ модального окна регистрации
function showRegisterModal() {
    document.getElementById('modalContainer').innerHTML = '';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Регистрация</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Имя</label>
                    <input type="text" class="form-input" id="regName" placeholder="Ваше имя">
                </div>
                <div class="form-group">
                    <label class="form-label">Телефон</label>
                    <input type="tel" class="form-input" id="regPhone" placeholder="+7 (999) 123-45-67">
                </div>
                <div class="form-group">
                    <label class="form-label">Адрес</label>
                    <input type="text" class="form-input" id="regAddress" placeholder="Ваш адрес">
                </div>
                <button class="btn btn-primary" onclick="register()">Зарегистрироваться</button>
            </div>
        </div>
    `;
    
    document.getElementById('modalContainer').appendChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
}
