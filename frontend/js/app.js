// Глобальные переменные
let currentUser = null;
let currentPage = 'main';
let tg = null;

// Конфигурация
const API_URL = window.location.origin;
const ADMIN_ID = 'ваш_telegram_id'; // Замените на свой ID

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 PWA запускается...');
    
    // Инициализация Telegram WebApp (если есть)
    if (window.Telegram?.WebApp) {
        tg = window.Telegram.WebApp;
        tg.expand();
        tg.ready();
        tg.setHeaderColor('#FF8C00');
        tg.setBackgroundColor('#FF8C00');
        
        // Обработка кнопки назад
        const backButton = tg.BackButton;
        backButton.onClick(() => {
            if (history.length > 1) {
                history.back();
            } else {
                tg.close();
            }
        });
    }
    
    // Проверка авторизации
    await checkAuth();
    
    // Инициализация Service Worker
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration);
            
            // Запрос разрешения на уведомления
            const permission = await Notification.requestPermission();
            console.log('Notification permission:', permission);
            
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
    
    // Настройка обработчиков событий
    setupEventListeners();
    
    // Скрываем сплеш-скрин
    setTimeout(() => {
        document.getElementById('splash-screen').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('splash-screen').style.display = 'none';
            document.getElementById('app-content').style.display = 'block';
        }, 500);
    }, 1000);
    
    // Загружаем начальную страницу
    await loadPage('main');
    
    // Подключаем WebSocket
    connectWebSocket();
});

// Проверка авторизации
async function checkAuth() {
    const token = localStorage.getItem('token');
    
    if (token) {
        try {
            const response = await api.get('/api/user/me');
            if (response.ok) {
                currentUser = response.data;
                updateUserInfo();
                
                // Проверка админа
                if (currentUser.user_id === ADMIN_ID) {
                    document.querySelectorAll('.admin-only').forEach(el => {
                        el.style.display = 'block';
                    });
                }
                
                return true;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
        }
        
        // Токен недействителен
        localStorage.removeItem('token');
    }
    
    // Показываем экран входа
    showAuthModal();
    return false;
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Меню
    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
    document.getElementById('sidebarOverlay').addEventListener('click', () => toggleSidebar(false));
    
    // Навигация по меню
    document.querySelectorAll('.sidebar-menu li[data-page], .nav-item[data-page]').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            loadPage(page);
            toggleSidebar(false);
        });
    });
    
    // Выход
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Обработка кнопки назад
    window.addEventListener('popstate', (event) => {
        if (event.state?.page) {
            loadPage(event.state.page, false);
        }
    });
}

// Переключение бокового меню
function toggleSidebar(force) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (force !== undefined) {
        sidebar.classList.toggle('open', force);
        overlay.classList.toggle('show', force);
    } else {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    }
}

// Обновление информации о пользователе
function updateUserInfo() {
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.name || 'Пользователь';
        document.getElementById('userId').textContent = `ID: ${currentUser.short_id || '---'}`;
        document.getElementById('bonusBadge').textContent = `${currentUser.bonus_balance || 0}💎`;
    }
}

// Загрузка страницы
async function loadPage(page, addToHistory = true) {
    console.log(`📄 Загрузка страницы: ${page}`);
    
    if (!currentUser && page !== 'auth') {
        showAuthModal();
        return;
    }
    
    currentPage = page;
    document.getElementById('headerTitle').textContent = getPageTitle(page);
    
    // Обновление активных пунктов меню
    document.querySelectorAll('.sidebar-menu li, .nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.querySelectorAll(`[data-page="${page}"]`).forEach(item => {
        item.classList.add('active');
    });
    
    // Показываем загрузку
    const content = document.getElementById('mainContent');
    content.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Загрузка...</p></div>';
    
    // Загружаем контент
    try {
        switch (page) {
            case 'main':
                await loadMainPage();
                break;
            case 'orders':
                await loadOrdersPage();
                break;
            case 'reviews':
                await loadReviewsPage();
                break;
            case 'bonuses':
                await loadBonusesPage();
                break;
            case 'profile':
                await loadProfilePage();
                break;
            case 'admin':
                await loadAdminPage();
                break;
            default:
                content.innerHTML = '<div class="error">Страница не найдена</div>';
        }
    } catch (error) {
        console.error('Error loading page:', error);
        content.innerHTML = '<div class="error">Ошибка загрузки</div>';
    }
    
    // Добавляем в историю
    if (addToHistory) {
        history.pushState({ page }, '', `#${page}`);
    }
    
    // Показываем/скрываем кнопку назад в Telegram
    if (tg && addToHistory) {
        tg.BackButton.show();
    }
}

// Получение заголовка страницы
function getPageTitle(page) {
    const titles = {
        'main': 'Главная',
        'orders': 'Мои заказы',
        'reviews': 'Отзывы',
        'bonuses': 'Мои бонусы',
        'profile': 'Профиль',
        'admin': 'Админ-панель'
    };
    return titles[page] || 'У Нас Чисто';
}

// Загрузка главной страницы
async function loadMainPage() {
    const content = document.getElementById('mainContent');
    
    if (!currentUser) {
        content.innerHTML = '<div class="card"><p>Пожалуйста, войдите в систему</p><button class="btn btn-primary" onclick="showAuthModal()">Войти</button></div>';
        return;
    }
    
    content.innerHTML = `
        <div class="card">
            <h2>Привет, ${currentUser.name}!</h2>
            <p>Ваш ID: <strong>${currentUser.short_id}</strong></p>
            <p>Баланс бонусов: <strong>${currentUser.bonus_balance || 0}💎</strong></p>
        </div>
        
        <div class="card">
            <h3>🚮 Заказать вынос</h3>
            <p>Выберите количество пакетов:</p>
            <div class="bags-grid" id="bagsGrid"></div>
            <div id="orderForm" style="display: none;">
                <div class="form-group">
                    <label class="form-label">Адрес</label>
                    <input type="text" class="form-input" id="orderAddress" value="${currentUser.address || ''}" placeholder="Ваш адрес">
                </div>
                <div class="form-group">
                    <label class="form-label">Время</label>
                    <input type="text" class="form-input" id="orderTime" placeholder="Например: сегодня 20:30">
                </div>
                <button class="btn btn-primary" onclick="createOrder()">Заказать</button>
            </div>
        </div>
        
        <div class="card">
            <h3>⭐ Последние отзывы</h3>
            <div id="recentReviews"></div>
        </div>
    `;
    
    // Загружаем последние отзывы
    loadRecentReviews();
    
    // Создаем сетку пакетов
    const bagsGrid = document.getElementById('bagsGrid');
    for (let i = 1; i <= 5; i++) {
        const price = i === 1 ? 100 : 100 + (i - 1) * 25;
        const div = document.createElement('div');
        div.className = 'bags-option';
        div.innerHTML = `
            <div class="bags-count">${i}</div>
            <div class="bags-price">${price}₽</div>
        `;
        div.onclick = () => selectBags(i);
        bagsGrid.appendChild(div);
    }
}

// Выбор количества пакетов
let selectedBags = 0;
function selectBags(count) {
    selectedBags = count;
    
    // Подсветка выбранного
    document.querySelectorAll('.bags-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Показываем форму
    document.getElementById('orderForm').style.display = 'block';
}

// Создание заказа
async function createOrder() {
    const address = document.getElementById('orderAddress').value;
    const time = document.getElementById('orderTime').value;
    
    if (!address) {
        showToast('Введите адрес', 'error');
        return;
    }
    
    if (!time) {
        showToast('Введите время', 'error');
        return;
    }
    
    const response = await api.post('/api/orders/create', {
        bags: selectedBags,
        exact_time: time,
        address: address,
        bonus_used: 0
    });
    
    if (response.ok) {
        showToast(`Заказ ${response.data.number} создан!`, 'success');
        loadPage('orders');
    } else {
        showToast(response.data.error || 'Ошибка создания заказа', 'error');
    }
}

// Загрузка последних отзывов
async function loadRecentReviews() {
    const response = await api.get('/api/reviews');
    if (response.ok && response.data.reviews) {
        const reviews = response.data.reviews.slice(0, 3);
        const container = document.getElementById('recentReviews');
        
        if (reviews.length === 0) {
            container.innerHTML = '<p>Пока нет отзывов</p>';
            return;
        }
        
        container.innerHTML = reviews.map(r => `
            <div class="review-card" style="margin-bottom: 10px;">
                <div class="review-header">
                    <span class="review-order">Заказ ${r.order_number}</span>
                    <span class="review-date">${r.date}</span>
                </div>
                <div class="review-rating">${'⭐'.repeat(r.rating)}</div>
                ${r.text ? `<div class="review-text">${r.text}</div>` : ''}
            </div>
        `).join('');
    }
}

// Выход
async function logout() {
    const confirmed = await showConfirm('Вы уверены, что хотите выйти?');
    if (confirmed) {
        localStorage.removeItem('token');
        currentUser = null;
        location.reload();
    }
}

// Показ уведомления
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, duration);
}

// Показ модального окна подтверждения
function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Подтверждение</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="confirmNo">Отмена</button>
                    <button class="btn btn-primary" id="confirmYes">Да</button>
                </div>
            </div>
        `;
        
        document.getElementById('modalContainer').appendChild(modal);
        
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
            resolve(false);
        });
        
        modal.querySelector('#confirmNo').addEventListener('click', () => {
            modal.remove();
            resolve(false);
        });
        
        modal.querySelector('#confirmYes').addEventListener('click', () => {
            modal.remove();
            resolve(true);
        });
    });
}

// Показ модального окна входа
function showAuthModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Вход в систему</h3>
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
        currentUser = response.data.user;
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
        currentUser = response.data.user;
        updateUserInfo();
        document.getElementById('modalContainer').innerHTML = '';
        loadPage('main');
        showToast('Регистрация успешна!', 'success');
    } else {
        showToast(response.data.error || 'Ошибка регистрации', 'error');
    }
}



// WebSocket клиент
// WebSocket клиент
let socket = null;
let socketReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function connectWebSocket() {
    // Не подключаемся, если уже есть соединение или слишком много попыток
    if (socket || socketReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        return;
    }
    
    // Определяем протокол (wss для HTTPS, ws для HTTP)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/socket.io/`;
    
    console.log('🔄 Подключение к WebSocket:', wsUrl);
    
    try {
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            console.log('✅ WebSocket connected');
            socketReconnectAttempts = 0; // Сбрасываем счетчик при успехе
            
            // Отправляем приветственное сообщение
            socket.send(JSON.stringify({
                type: 'join',
                user_id: currentUser?.user_id,
                timestamp: Date.now()
            }));
            
            // Если админ - подключаемся к админской комнате
            if (currentUser?.user_id === ADMIN_ID) {
                socket.send(JSON.stringify({
                    type: 'join_admin'
                }));
            }
        };
        
        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📩 WebSocket message:', data);
                handleWebSocketMessage(data);
            } catch (e) {
                console.error('WebSocket message error:', e);
            }
        };
        
        socket.onerror = (error) => {
            console.log('⚠️ WebSocket error (нормально для бесплатного тарифа)');
            // Не показываем ошибку пользователю - это ожидаемо для Render free tier
        };
        
        socket.onclose = (event) => {
            console.log('🔌 WebSocket disconnected:', event.code, event.reason);
            socket = null;
            
            // Пытаемся переподключиться с увеличивающейся задержкой
            if (socketReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                socketReconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, socketReconnectAttempts), 30000);
                console.log(`🔄 Reconnect attempt ${socketReconnectAttempts} in ${delay}ms`);
                setTimeout(connectWebSocket, delay);
            }
        };
        
    } catch (error) {
        console.log('❌ WebSocket creation failed:', error);
        socket = null;
    }
}

// Упрощенная версия для постоянного подключения (мягко)
setInterval(() => {
    // Пытаемся подключиться только если есть пользователь и нет соединения
    if (currentUser && !socket && socketReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        connectWebSocket();
    }
}, 10000); // Проверяем каждые 10 секунд, а не каждую секунду
