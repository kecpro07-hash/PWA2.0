// Глобальные переменные
let currentPage = 'main';
let tg = null;

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
        
        const backButton = tg.BackButton;
        backButton.onClick(() => {
            if (history.length > 1) {
                history.back();
            } else {
                tg.close();
            }
        });
        
        // Автоматический вход через Telegram
        const tgUser = tg.initDataUnsafe?.user;
        if (tgUser && !window.auth?.isAuthenticated()) {
            await window.auth?.loginWithTelegram(tgUser);
        }
    }
    
    // Инициализация авторизации
    const isLoggedIn = await window.auth.init();
    
    if (!isLoggedIn) {
        showAuthModal();
    }
    
    // Инициализация Service Worker
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered');
        } catch (error) {
            console.error('Service Worker failed:', error);
        }
    }
    
    // Настройка обработчиков
    setupEventListeners();
    
    // Скрываем сплеш-скрин
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                document.getElementById('app-content').style.display = 'block';
            }, 500);
        }
    }, 1000);
    
    // Загружаем начальную страницу
    if (isLoggedIn) {
        await loadPage('main');
    }
});

// Настройка обработчиков событий
function setupEventListeners() {
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }
    
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
        overlay.addEventListener('click', () => toggleSidebar(false));
    }
    
    // Навигация по меню
    document.querySelectorAll('.sidebar-menu li[data-page], .nav-item[data-page]').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            loadPage(page);
            toggleSidebar(false);
        });
    });
    
    // Выход
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => window.auth?.logout());
    }
    
    // Обработка кнопки назад
    window.addEventListener('popstate', (event) => {
        if (event.state?.page) {
            loadPage(event.state.page, false);
        }
    });
}

// Загрузка страницы
async function loadPage(page, addToHistory = true) {
    const isLoggedIn = window.auth?.isAuthenticated();
    
    if (!isLoggedIn && page !== 'auth') {
        showAuthModal();
        return;
    }
    
    currentPage = page;
    document.getElementById('headerTitle').textContent = getPageTitle(page);
    
    // Обновление активных пунктов
    document.querySelectorAll('.sidebar-menu li, .nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.querySelectorAll(`[data-page="${page}"]`).forEach(item => {
        item.classList.add('active');
    });
    
    const content = document.getElementById('mainContent');
    content.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Загрузка...</p></div>';
    
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
    
    if (addToHistory) {
        history.pushState({ page }, '', `#${page}`);
    }
    
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
    const user = window.auth?.getCurrentUser();
    const content = document.getElementById('mainContent');
    
    if (!user) {
        content.innerHTML = `
            <div class="card text-center">
                <p>Пожалуйста, войдите в систему</p>
                <button class="btn btn-primary" onclick="showAuthModal()">Войти</button>
            </div>
        `;
        return;
    }
    
    content.innerHTML = `
        <div class="card">
            <h2>Привет, ${user.name}!</h2>
            <p>Ваш ID: <strong>${user.short_id || '---'}</strong></p>
            <p>Баланс бонусов: <strong>${user.bonus_balance || 0}💎</strong></p>
        </div>
        
        <div class="card">
            <h3>🚮 Заказать вынос</h3>
            <p>Выберите количество пакетов:</p>
            <div class="bags-grid" id="bagsGrid"></div>
            <div id="orderForm" style="display: none;">
                <div class="form-group">
                    <label class="form-label">Адрес</label>
                    <input type="text" class="form-input" id="orderAddress" value="${user.address || ''}" placeholder="Ваш адрес">
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
    
    loadRecentReviews();
    
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

// Загрузка страницы профиля
async function loadProfilePage() {
    const user = window.auth?.getCurrentUser();
    const content = document.getElementById('mainContent');
    
    if (!user) {
        content.innerHTML = '<div class="card">Пожалуйста, войдите в систему</div>';
        return;
    }
    
    content.innerHTML = `
        <div class="profile-header">
            <div class="profile-avatar">👤</div>
            <div class="profile-name">${user.name}</div>
            <div class="profile-id">ID: ${user.short_id || '---'}</div>
        </div>
        
        <div class="profile-field" onclick="editField('name')">
            <div class="profile-field-label">Имя</div>
            <div class="profile-field-value">${user.name || 'Не указано'}</div>
        </div>
        
        <div class="profile-field" onclick="editField('phone')">
            <div class="profile-field-label">Телефон</div>
            <div class="profile-field-value">${user.phone || 'Не указано'}</div>
        </div>
        
        <div class="profile-field" onclick="editField('address')">
            <div class="profile-field-label">Адрес</div>
            <div class="profile-field-value">${user.address || 'Не указано'}</div>
        </div>
        
        <button class="btn btn-danger" onclick="window.auth?.logout()">Выйти</button>
    `;
}

// Редактирование поля
function editField(field) {
    const user = window.auth?.getCurrentUser();
    if (!user) return;
    
    const fieldNames = {
        'name': 'Имя',
        'phone': 'Телефон',
        'address': 'Адрес'
    };
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Редактировать ${fieldNames[field]}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <input type="text" class="form-input" id="editValue" value="${user[field] || ''}">
                <button class="btn btn-primary" onclick="saveField('${field}')">Сохранить</button>
            </div>
        </div>
    `;
    
    document.getElementById('modalContainer').appendChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
}

// Сохранение поля
async function saveField(field) {
    const value = document.getElementById('editValue').value;
    if (!value) {
        showToast('Введите значение', 'error');
        return;
    }
    
    const success = await window.auth?.updateProfile(field, value);
    if (success) {
        document.getElementById('modalContainer').innerHTML = '';
        loadProfilePage();
    }
}

// Выбор пакетов
let selectedBags = 0;

function selectBags(count) {
    selectedBags = count;
    document.querySelectorAll('.bags-option').forEach(opt => opt.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
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

// Переключение бокового меню
function toggleSidebar(force) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (force !== undefined) {
        sidebar?.classList.toggle('open', force);
        overlay?.classList.toggle('show', force);
    } else {
        sidebar?.classList.toggle('open');
        overlay?.classList.toggle('show');
    }
}

// Экспорт глобальных функций
window.showAuthModal = showAuthModal;
window.createOrder = createOrder;
window.selectBags = selectBags;
window.editField = editField;
window.saveField = saveField;
window.loadPage = loadPage;
