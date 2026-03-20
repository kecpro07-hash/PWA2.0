// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentPage = 'main';
let tg = null;
let selectedBags = 0;

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 PWA запускается...');
    
    // Telegram WebApp
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
        
        const tgUser = tg.initDataUnsafe?.user;
        if (tgUser && window.auth && !window.auth.isAuthenticated()) {
            await window.auth.loginWithTelegram(tgUser);
        }
    }
    
    // Проверка авторизации
    const isLoggedIn = await window.auth?.init();
    
    if (!isLoggedIn && window.showAuthModal) {
        window.showAuthModal();
    }
    
    // Service Worker
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/sw.js');
            console.log('✅ Service Worker зарегистрирован');
        } catch (error) {
            console.error('❌ Service Worker ошибка:', error);
        }
    }
    
    // Обработчики
    setupEventListeners();
    
    // Скрываем загрузку
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                const appContent = document.getElementById('app-content');
                if (appContent) appContent.style.display = 'block';
            }, 500);
        }
    }, 1000);
    
    if (isLoggedIn) {
        await loadPage('main');
    }
});

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================

function setupEventListeners() {
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => toggleSidebar());
    }
    
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
        overlay.addEventListener('click', () => toggleSidebar(false));
    }
    
    document.querySelectorAll('.sidebar-menu li[data-page], .nav-item[data-page]').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            loadPage(page);
            toggleSidebar(false);
        });
    });
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => window.auth?.logout());
    }
    
    window.addEventListener('popstate', (event) => {
        if (event.state?.page) {
            loadPage(event.state.page, false);
        }
    });
}

// ==================== УПРАВЛЕНИЕ СТРАНИЦАМИ ====================

async function loadPage(page, addToHistory = true) {
    console.log(`📄 Загрузка: ${page}`);
    
    const isLoggedIn = window.auth?.isAuthenticated();
    if (!isLoggedIn && page !== 'auth') {
        if (window.showAuthModal) window.showAuthModal();
        return;
    }
    
    currentPage = page;
    
    const headerTitle = document.getElementById('headerTitle');
    if (headerTitle) headerTitle.textContent = getPageTitle(page);
    
    document.querySelectorAll('.sidebar-menu li, .nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelectorAll(`[data-page="${page}"]`).forEach(item => {
        item.classList.add('active');
    });
    
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        mainContent.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Загрузка...</p></div>';
    }
    
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
                if (mainContent) mainContent.innerHTML = '<div class="error">Страница не найдена</div>';
        }
    } catch (error) {
        console.error('Ошибка:', error);
        if (mainContent) mainContent.innerHTML = '<div class="error">Ошибка загрузки</div>';
    }
    
    if (addToHistory) {
        history.pushState({ page }, '', `#${page}`);
    }
    
    if (tg && addToHistory) {
        tg.BackButton.show();
    }
}

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

// ==================== ГЛАВНАЯ СТРАНИЦА ====================

async function loadMainPage() {
    const user = window.auth?.getCurrentUser();
    const mainContent = document.getElementById('mainContent');
    
    if (!user) {
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="card text-center">
                    <p>Пожалуйста, войдите в систему</p>
                    <button class="btn btn-primary" onclick="window.showAuthModal()">Войти</button>
                </div>
            `;
        }
        return;
    }
    
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="card">
                <h2>Привет, ${escapeHtml(user.name)}!</h2>
                <p>Ваш ID: <strong>${escapeHtml(user.short_id || '---')}</strong></p>
                <p>Баланс бонусов: <strong>${user.bonus_balance || 0}💎</strong></p>
            </div>
            
            <div class="card">
                <h3>🚮 Заказать вынос</h3>
                <p>Выберите количество пакетов:</p>
                <div class="bags-grid" id="bagsGrid"></div>
                <div id="orderForm" style="display: none;">
                    <div class="form-group">
                        <label class="form-label">Адрес</label>
                        <input type="text" class="form-input" id="orderAddress" value="${escapeHtml(user.address || '')}" placeholder="Ваш адрес">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Время</label>
                        <input type="text" class="form-input" id="orderTime" placeholder="Например: сегодня 20:30">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Использовать бонусы</label>
                        <input type="number" class="form-input" id="bonusToUse" value="0" min="0" max="${user.bonus_balance || 0}">
                    </div>
                    <button class="btn btn-primary" onclick="createOrder()">Заказать</button>
                </div>
            </div>
            
            <div class="card">
                <h3>⭐ Последние отзывы</h3>
                <div id="recentReviews"></div>
            </div>
        `;
    }
    
    loadRecentReviews();
    
    const bagsGrid = document.getElementById('bagsGrid');
    if (bagsGrid) {
        for (let i = 1; i <= 5; i++) {
            const price = i === 1 ? 100 : 100 + (i - 1) * 25;
            const div = document.createElement('div');
            div.className = 'bags-option';
            div.innerHTML = `<div class="bags-count">${i}</div><div class="bags-price">${price}₽</div>`;
            div.onclick = () => selectBags(i);
            bagsGrid.appendChild(div);
        }
    }
}

function selectBags(count) {
    selectedBags = count;
    document.querySelectorAll('.bags-option').forEach(opt => opt.classList.remove('selected'));
    if (event?.currentTarget) event.currentTarget.classList.add('selected');
    const orderForm = document.getElementById('orderForm');
    if (orderForm) orderForm.style.display = 'block';
}

async function createOrder() {
    const address = document.getElementById('orderAddress')?.value;
    const time = document.getElementById('orderTime')?.value;
    const bonusToUse = parseInt(document.getElementById('bonusToUse')?.value || '0');
    
    if (!address) { showToast('Введите адрес', 'error'); return; }
    if (!time) { showToast('Введите время', 'error'); return; }
    
    const user = window.auth?.getCurrentUser();
    if (bonusToUse > (user?.bonus_balance || 0)) {
        showToast('Недостаточно бонусов', 'error');
        return;
    }
    
    const response = await api.post('/api/orders/create', {
        bags: selectedBags,
        exact_time: time,
        address: address,
        bonus_used: bonusToUse
    });
    
    if (response.ok) {
        showToast(`Заказ ${response.data.number} создан!`, 'success');
        loadPage('orders');
    } else {
        showToast(response.data.error || 'Ошибка создания заказа', 'error');
    }
}

async function loadRecentReviews() {
    const response = await api.get('/api/reviews');
    const container = document.getElementById('recentReviews');
    if (!container) return;
    
    if (response.ok && response.data.reviews?.length) {
        const reviews = response.data.reviews.slice(0, 3);
        container.innerHTML = reviews.map(r => `
            <div class="review-card" style="margin-bottom: 10px;">
                <div class="review-header">
                    <span class="review-order">Заказ ${escapeHtml(r.order_number)}</span>
                    <span class="review-date">${escapeHtml(r.date)}</span>
                </div>
                <div class="review-rating">${'⭐'.repeat(r.rating)}</div>
                ${r.text ? `<div class="review-text">${escapeHtml(r.text)}</div>` : ''}
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p>Пока нет отзывов</p>';
    }
}

// ==================== СТРАНИЦА ЗАКАЗОВ ====================

async function loadOrdersPage() {
    const mainContent = document.getElementById('mainContent');
    const response = await api.get('/api/orders');
    
    if (!response.ok) {
        if (mainContent) mainContent.innerHTML = '<div class="error">Ошибка загрузки</div>';
        return;
    }
    
    const orders = response.data;
    
    if (!orders?.length) {
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="card text-center">
                    <h3>📭 У вас пока нет заказов</h3>
                    <button class="btn btn-primary" onclick="loadPage('main')">Сделать заказ</button>
                </div>
            `;
        }
        return;
    }
    
    let html = '<h2>Мои заказы</h2>';
    orders.forEach(order => {
        const statusClass = { 'новый': 'new', 'выполнен': 'completed', 'отменен': 'cancelled' }[order.status] || '';
        const statusText = { 'новый': '🆕 Новый', 'выполнен': '✅ Выполнен', 'отменен': '❌ Отменен' }[order.status] || order.status;
        const priceDisplay = order.final_amount !== order.amount 
            ? `<span class="old">${order.amount}₽</span> ${order.final_amount}₽`
            : `${order.final_amount}₽`;
        
        html += `
            <div class="order-card" onclick="showOrderDetails('${order.number}')">
                <div class="order-header">
                    <span class="order-number">Заказ ${escapeHtml(order.number)}</span>
                    <span class="order-status ${statusClass}">${statusText}</span>
                </div>
                <div class="order-detail">🕐 ${escapeHtml(order.exact_time)}</div>
                <div class="order-detail">📦 ${order.bags} пакет(ов)</div>
                <div class="order-price">${priceDisplay}</div>
                ${order.bonus_used > 0 ? `<div class="order-detail">💎 -${order.bonus_used} бонусов</div>` : ''}
            </div>
        `;
    });
    
    if (mainContent) mainContent.innerHTML = html;
}

async function showOrderDetails(orderNumber) {
    const response = await api.get('/api/orders');
    if (!response.ok) return;
    const order = response.data.find(o => o.number === orderNumber);
    if (!order) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Заказ ${escapeHtml(order.number)}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p><strong>Статус:</strong> ${order.status}</p>
                <p><strong>Время:</strong> ${escapeHtml(order.exact_time)}</p>
                <p><strong>Адрес:</strong> ${escapeHtml(order.address)}</p>
                <p><strong>Сумма:</strong> ${order.amount}₽</p>
                ${order.final_amount !== order.amount ? `<p><strong>Итого:</strong> ${order.final_amount}₽ (скидка ${order.bonus_discount}₽)</p>` : ''}
            </div>
        </div>
    `;
    
    const modalContainer = document.getElementById('modalContainer');
    if (modalContainer) modalContainer.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
}

// ==================== ДРУГИЕ СТРАНИЦЫ (ЗАГЛУШКИ) ====================

async function loadReviewsPage() {
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="card">
                <h3>⭐ Отзывы</h3>
                <button class="btn btn-primary" onclick="window.showAddReviewModal?.()">📝 Оставить отзыв</button>
            </div>
            <div id="reviewsList"></div>
        `;
    }
    
    const response = await api.get('/api/reviews');
    if (response.ok && response.data.reviews) {
        const container = document.getElementById('reviewsList');
        if (container) {
            container.innerHTML = response.data.reviews.map(r => `
                <div class="review-card">
                    <div class="review-header">
                        <span class="review-order">${r.order_number === 'GENERAL' ? 'Отзыв' : 'Заказ ' + r.order_number}</span>
                        <span class="review-date">${escapeHtml(r.date)}</span>
                    </div>
                    <div class="review-rating">${'⭐'.repeat(r.rating)}</div>
                    ${r.text ? `<div class="review-text">${escapeHtml(r.text)}</div>` : ''}
                </div>
            `).join('');
        }
    }
}

async function loadBonusesPage() {
    const mainContent = document.getElementById('mainContent');
    const user = window.auth?.getCurrentUser();
    
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="bonus-card">
                <div>Ваш баланс</div>
                <div class="bonus-amount">${user?.bonus_balance || 0} 💎</div>
                <div class="bonus-equivalent">≈ ${Math.floor((user?.bonus_balance || 0))} ₽ скидки</div>
            </div>
            <div class="card">
                <h3>Как это работает?</h3>
                <p>• За каждый заказ начисляется 10% бонусами</p>
                <p>• 1 бонус = 1 рубль скидки</p>
                <p>• Можно списать до 50% от суммы заказа</p>
            </div>
        `;
    }
}

async function loadProfilePage() {
    const user = window.auth?.getCurrentUser();
    const mainContent = document.getElementById('mainContent');
    
    if (!user) {
        if (mainContent) mainContent.innerHTML = '<div class="card">Войдите в систему</div>';
        return;
    }
    
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="profile-header">
                <div class="profile-avatar">👤</div>
                <div class="profile-name">${escapeHtml(user.name)}</div>
                <div class="profile-id">ID: ${escapeHtml(user.short_id || '---')}</div>
            </div>
            <div class="profile-field" onclick="editField('name')">
                <div class="profile-field-label">Имя</div>
                <div class="profile-field-value">${escapeHtml(user.name || 'Не указано')}</div>
            </div>
            <div class="profile-field" onclick="editField('phone')">
                <div class="profile-field-label">Телефон</div>
                <div class="profile-field-value">${escapeHtml(user.phone || 'Не указано')}</div>
            </div>
            <div class="profile-field" onclick="editField('address')">
                <div class="profile-field-label">Адрес</div>
                <div class="profile-field-value">${escapeHtml(user.address || 'Не указано')}</div>
            </div>
            <button class="btn btn-danger" onclick="window.auth?.logout()">🚪 Выйти</button>
        `;
    }
}

function editField(field) {
    const user = window.auth?.getCurrentUser();
    if (!user) return;
    
    const fieldNames = { 'name': 'Имя', 'phone': 'Телефон', 'address': 'Адрес' };
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Редактировать ${fieldNames[field]}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <input type="text" class="form-input" id="editValue" value="${escapeHtml(user[field] || '')}">
                <button class="btn btn-primary" onclick="saveField('${field}')">Сохранить</button>
            </div>
        </div>
    `;
    
    const modalContainer = document.getElementById('modalContainer');
    if (modalContainer) modalContainer.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
}

async function saveField(field) {
    const value = document.getElementById('editValue')?.value;
    if (!value) { showToast('Введите значение', 'error'); return; }
    
    const success = await window.auth?.updateProfile(field, value);
    if (success) {
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) modalContainer.innerHTML = '';
        loadProfilePage();
    }
}

async function loadAdminPage() {
    const mainContent = document.getElementById('mainContent');
    if (!window.auth?.isAdmin()) {
        if (mainContent) mainContent.innerHTML = '<div class="error">Доступ запрещен</div>';
        return;
    }
    
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="card">
                <h3>🔧 Админ-панель</h3>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn btn-small" onclick="loadAdminOrders()">📦 Заказы</button>
                    <button class="btn btn-small" onclick="loadAdminUsers()">👥 Пользователи</button>
                    <button class="btn btn-small" onclick="loadAdminStats()">📊 Статистика</button>
                </div>
            </div>
            <div id="adminContent"></div>
        `;
        loadAdminOrders();
    }
}

async function loadAdminOrders() {
    const container = document.getElementById('adminContent');
    if (!container) return;
    
    const response = await api.get('/api/admin/orders');
    if (!response.ok) { container.innerHTML = '<div class="error">Ошибка</div>'; return; }
    
    const orders = response.data;
    if (!orders?.length) { container.innerHTML = '<div class="card">Нет заказов</div>'; return; }
    
    let html = '<h3>Все заказы</h3>';
    orders.forEach(order => {
        html += `
            <div class="order-card">
                <div class="order-header">
                    <span class="order-number">${escapeHtml(order.number)}</span>
                    <span class="order-status">${order.status}</span>
                </div>
                <div>👤 ${escapeHtml(order.name)} (${escapeHtml(order.short_id)})</div>
                <div>📍 ${escapeHtml(order.address)}</div>
                <div>🕐 ${escapeHtml(order.exact_time)}</div>
                <div>💰 ${order.amount}₽</div>
                <div class="admin-actions" style="margin-top: 10px; display: flex; gap: 10px;">
                    <button class="btn btn-small btn-success" onclick="updateOrderStatus('${order.number}', 'выполнен')">✅ Выполнен</button>
                    <button class="btn btn-small btn-danger" onclick="updateOrderStatus('${order.number}', 'отменен')">❌ Отменен</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

async function loadAdminUsers() {
    const container = document.getElementById('adminContent');
    if (!container) return;
    
    const response = await api.get('/api/admin/users');
    if (!response.ok) { container.innerHTML = '<div class="error">Ошибка</div>'; return; }
    
    const users = response.data;
    let html = '<h3>Пользователи</h3>';
    users.forEach(user => {
        html += `
            <div class="card">
                <div><strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.short_id)})</div>
                <div>📱 ${escapeHtml(user.phone || 'нет')}</div>
                <div>💎 ${user.bonus_balance || 0} бонусов</div>
            </div>
        `;
    });
    container.innerHTML = html;
}

async function loadAdminStats() {
    const container = document.getElementById('adminContent');
    if (!container) return;
    container.innerHTML = '<div class="card"><h3>📊 Статистика</h3><p>Загрузка...</p></div>';
}

async function updateOrderStatus(orderNumber, status) {
    const response = await api.put(`/api/admin/order/${orderNumber}/status`, { status });
    if (response.ok) {
        showToast(`Статус заказа ${orderNumber} изменен`, 'success');
        loadAdminOrders();
    } else {
        showToast('Ошибка', 'error');
    }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ====================

function toggleSidebar(force) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (force !== undefined) {
        if (sidebar) sidebar.classList.toggle('open', force);
        if (overlay) overlay.classList.toggle('show', force);
    } else {
        if (sidebar) sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('show');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Экспорт глобальных функций
window.loadPage = loadPage;
window.createOrder = createOrder;
window.selectBags = selectBags;
window.editField = editField;
window.saveField = saveField;
window.showOrderDetails = showOrderDetails;
window.loadAdminOrders = loadAdminOrders;
window.loadAdminUsers = loadAdminUsers;
window.loadAdminStats = loadAdminStats;
window.updateOrderStatus = updateOrderStatus;
window.toggleSidebar = toggleSidebar;
window.escapeHtml = escapeHtml;

console.log('📱 App загружен');
