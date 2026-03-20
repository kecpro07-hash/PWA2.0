// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentPage = 'main';
let tg = null;
let selectedBags = 0;

// ==================== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ====================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 PWA запускается...');
    
    // Инициализация Telegram WebApp (если открыто в Telegram)
    if (window.Telegram?.WebApp) {
        tg = window.Telegram.WebApp;
        tg.expand();
        tg.ready();
        tg.setHeaderColor('#FF8C00');
        tg.setBackgroundColor('#FF8C00');
        
        // Настройка кнопки назад
        const backButton = tg.BackButton;
        backButton.onClick(() => {
            if (history.length > 1) {
                history.back();
            } else {
                tg.close();
            }
        });
        
        // Автоматический вход через Telegram, если пользователь уже в Telegram
        const tgUser = tg.initDataUnsafe?.user;
        if (tgUser && !window.auth?.isAuthenticated()) {
            console.log('🔄 Автоматический вход через Telegram');
            await window.auth?.loginWithTelegram(tgUser);
        }
    }
    
    // Инициализация системы авторизации
    const isLoggedIn = await window.auth?.init();
    
    // Если не авторизован - показываем форму входа
    if (!isLoggedIn) {
        showAuthModal();
    }
    
    // Инициализация Service Worker (PWA)
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ Service Worker зарегистрирован');
            
            // Запрос разрешения на уведомления
            const permission = await Notification.requestPermission();
            console.log('📢 Уведомления:', permission);
            
        } catch (error) {
            console.error('❌ Service Worker ошибка:', error);
        }
    }
    
    // Настройка обработчиков событий
    setupEventListeners();
    
    // Скрываем экран загрузки
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                const appContent = document.getElementById('app-content');
                if (appContent) {
                    appContent.style.display = 'block';
                }
            }, 500);
        }
    }, 1000);
    
    // Загружаем главную страницу если авторизован
    if (isLoggedIn) {
        await loadPage('main');
    }
});

// ==================== НАСТРОЙКА ОБРАБОТЧИКОВ ====================

function setupEventListeners() {
    // Меню
    const menuToggle = document.getElementById('menuToggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => toggleSidebar());
    }
    
    // Оверлей меню
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
        overlay.addEventListener('click', () => toggleSidebar(false));
    }
    
    // Навигация по боковому меню
    document.querySelectorAll('.sidebar-menu li[data-page]').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            loadPage(page);
            toggleSidebar(false);
        });
    });
    
    // Нижняя навигация
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            loadPage(page);
        });
    });
    
    // Кнопка выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => window.auth?.logout());
    }
    
    // Обработка кнопки назад в браузере
    window.addEventListener('popstate', (event) => {
        if (event.state?.page) {
            loadPage(event.state.page, false);
        }
    });
}

// ==================== УПРАВЛЕНИЕ СТРАНИЦАМИ ====================

async function loadPage(page, addToHistory = true) {
    console.log(`📄 Загрузка страницы: ${page}`);
    
    // Проверка авторизации
    const isLoggedIn = window.auth?.isAuthenticated();
    if (!isLoggedIn && page !== 'auth') {
        showAuthModal();
        return;
    }
    
    currentPage = page;
    
    // Обновляем заголовок
    const headerTitle = document.getElementById('headerTitle');
    if (headerTitle) {
        headerTitle.textContent = getPageTitle(page);
    }
    
    // Обновляем активные пункты меню
    document.querySelectorAll('.sidebar-menu li, .nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.querySelectorAll(`[data-page="${page}"]`).forEach(item => {
        item.classList.add('active');
    });
    
    // Показываем загрузку
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Загрузка...</p>
            </div>
        `;
    }
    
    // Загружаем контент страницы
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
                if (mainContent) {
                    mainContent.innerHTML = '<div class="error">Страница не найдена</div>';
                }
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки страницы:', error);
        if (mainContent) {
            mainContent.innerHTML = '<div class="error">Ошибка загрузки. Попробуйте обновить страницу.</div>';
        }
    }
    
    // Добавляем в историю браузера
    if (addToHistory) {
        history.pushState({ page }, '', `#${page}`);
    }
    
    // Показываем кнопку назад в Telegram
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
                    <button class="btn btn-primary" onclick="showAuthModal()">Войти</button>
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
    
    // Загружаем последние отзывы
    loadRecentReviews();
    
    // Создаем сетку выбора пакетов
    const bagsGrid = document.getElementById('bagsGrid');
    if (bagsGrid) {
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
}

// Выбор количества пакетов
function selectBags(count) {
    selectedBags = count;
    
    // Подсветка выбранного
    document.querySelectorAll('.bags-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    if (event?.currentTarget) {
        event.currentTarget.classList.add('selected');
    }
    
    // Показываем форму заказа
    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
        orderForm.style.display = 'block';
    }
}

// Создание заказа
async function createOrder() {
    const address = document.getElementById('orderAddress')?.value;
    const time = document.getElementById('orderTime')?.value;
    const bonusToUse = parseInt(document.getElementById('bonusToUse')?.value || '0');
    
    if (!address) {
        showToast('Введите адрес', 'error');
        return;
    }
    
    if (!time) {
        showToast('Введите время', 'error');
        return;
    }
    
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

// Загрузка последних отзывов
async function loadRecentReviews() {
    const response = await api.get('/api/reviews');
    const container = document.getElementById('recentReviews');
    
    if (!container) return;
    
    if (response.ok && response.data.reviews && response.data.reviews.length > 0) {
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
        if (mainContent) {
            mainContent.innerHTML = '<div class="error">Ошибка загрузки заказов</div>';
        }
        return;
    }
    
    const orders = response.data;
    
    if (!orders || orders.length === 0) {
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="card text-center">
                    <h3>📭 У вас пока нет заказов</h3>
                    <p>Сделайте первый заказ на главной странице</p>
                    <button class="btn btn-primary" onclick="loadPage('main')">На главную</button>
                </div>
            `;
        }
        return;
    }
    
    let html = '<h2>Мои заказы</h2>';
    
    orders.forEach(order => {
        const statusClass = {
            'новый': 'new',
            'выполнен': 'completed',
            'отменен': 'cancelled'
        }[order.status] || '';
        
        const statusText = {
            'новый': '🆕 Новый',
            'выполнен': '✅ Выполнен',
            'отменен': '❌ Отменен'
        }[order.status] || order.status;
        
        const priceDisplay = order.final_amount !== order.amount 
            ? `<span class="old">${order.amount}₽</span> ${order.final_amount}₽`
            : `${order.final_amount}₽`;
        
        html += `
            <div class="order-card" onclick="showOrderDetails('${order.number}')">
                <div class="order-header">
                    <span class="order-number">Заказ ${escapeHtml(order.number)}</span>
                    <span class="order-status ${statusClass}">${statusText}</span>
                </div>
                <div class="order-detail">
                    <span class="order-detail-icon">🕐</span>
                    <span>${escapeHtml(order.exact_time)}</span>
                </div>
                <div class="order-detail">
                    <span class="order-detail-icon">📦</span>
                    <span>${order.bags} пакет(ов)</span>
                </div>
                <div class="order-detail">
                    <span class="order-detail-icon">💰</span>
                    <span>${order.payment === 'оплачен' ? '✅ Оплачено' : '⏳ Ожидает оплаты'}</span>
                </div>
                <div class="order-price">
                    ${priceDisplay}
                    ${order.bonus_used > 0 ? `<br><small>💎 Использовано бонусов: ${order.bonus_used}</small>` : ''}
                </div>
                ${order.reviewed ? '<div class="order-detail"><span class="order-detail-icon">⭐</span><span>Отзыв оставлен</span></div>' : ''}
            </div>
        `;
    });
    
    if (mainContent) {
        mainContent.innerHTML = html;
    }
}

// Показ деталей заказа
async function showOrderDetails(orderNumber) {
    const response = await api.get('/api/orders');
    if (!response.ok) return;
    
    const order = response.data.find(o => o.number === orderNumber);
    if (!order) return;
    
    const statusClass = {
        'новый': 'new',
        'выполнен': 'completed',
        'отменен': 'cancelled'
    }[order.status] || '';
    
    const statusText = {
        'новый': '🆕 Новый',
        'выполнен': '✅ Выполнен',
        'отменен': '❌ Отменен'
    }[order.status] || order.status;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Заказ ${escapeHtml(order.number)}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="card">
                    <p><strong>Статус:</strong> <span class="order-status ${statusClass}">${statusText}</span></p>
                    <p><strong>Время:</strong> ${escapeHtml(order.exact_time)}</p>
                    <p><strong>Пакетов:</strong> ${order.bags}</p>
                    <p><strong>Адрес:</strong> ${escapeHtml(order.address)}</p>
                    <p><strong>Сумма:</strong> ${order.amount}₽</p>
                    ${order.final_amount !== order.amount ? `
                        <p><strong>Итоговая сумма:</strong> ${order.final_amount}₽</p>
                        <p><strong>Списано бонусов:</strong> ${order.bonus_used} (скидка ${order.bonus_discount}₽)</p>
                    ` : ''}
                    <p><strong>Оплата:</strong> ${order.payment === 'оплачен' ? '✅ Оплачено' : '⏳ Ожидает'}</p>
                </div>
                
                ${order.status === 'выполнен' && !order.reviewed ? `
                    <div class="card">
                        <h4>Оставить отзыв</h4>
                        <div class="rating-selector" id="ratingSelector">
                            ${[1,2,3,4,5].map(r => `<span class="star" data-rating="${r}">☆</span>`).join('')}
                        </div>
                        <textarea class="form-input" id="reviewText" placeholder="Ваш отзыв (необязательно)" rows="3"></textarea>
                        <button class="btn btn-primary" onclick="submitReview('${order.number}')">Отправить</button>
                    </div>
                ` : ''}
                
                ${order.status === 'новый' ? `
                    <div class="card">
                        <h4>Инструкция</h4>
                        <p>1. Будьте на связи в указанное время</p>
                        <p>2. Оплатите заказ перед выносом</p>
                        <p>3. Выставьте пакеты за дверь</p>
                        <p>4. СБП: ${CONFIG?.SBP_PHONE || '8(906)801 67 38'}</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    const modalContainer = document.getElementById('modalContainer');
    if (modalContainer) {
        modalContainer.appendChild(modal);
    }
    
    // Закрытие модалки
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    // Настройка звезд для рейтинга
    const stars = modal.querySelectorAll('.rating-selector .star');
    let selectedRating = null;
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.dataset.rating);
            selectedRating = rating;
            stars.forEach((s, i) => {
                if (i < rating) {
                    s.textContent = '★';
                    s.style.color = '#FFD700';
                } else {
                    s.textContent = '☆';
                    s.style.color = '#ddd';
                }
            });
        });
    });
    
    window.submitReview = async function(orderNumber) {
        if (!selectedRating) {
            showToast('Поставьте оценку', 'error');
            return;
        }
        
        const text = document.getElementById('reviewText')?.value || '';
        
        const reviewResponse = await api.post('/api/reviews/add', {
            order_number: orderNumber,
            rating: selectedRating,
            text: text
        });
        
        if (reviewResponse.ok) {
            showToast('Спасибо за отзыв!', 'success');
            modal.remove();
            loadOrdersPage();
        } else {
            showToast(reviewResponse.data.error || 'Ошибка', 'error');
        }
    };
}

// ==================== СТРАНИЦА ОТЗЫВОВ ====================

async function loadReviewsPage() {
    const mainContent = document.getElementById('mainContent');
    
    const response = await api.get('/api/reviews');
    
    if (!response.ok) {
        if (mainContent) {
            mainContent.innerHTML = '<div class="error">Ошибка загрузки отзывов</div>';
        }
        return;
    }
    
    const data = response.data;
    const reviews = data.reviews || [];
    const stats = data.stats || { total: 0, average: 0, five_stars: 0 };
    
    let html = `
        <div class="stats-card">
            <div class="stats-item">
                <div class="stats-value">${stats.total}</div>
                <div class="stats-label">всего отзывов</div>
            </div>
            <div class="stats-item">
                <div class="stats-value">${stats.average}</div>
                <div class="stats-label">средний рейтинг</div>
            </div>
            <div class="stats-item">
                <div class="stats-value">${stats.five_stars}</div>
                <div class="stats-label">5 ⭐</div>
            </div>
        </div>
    `;
    
    if (window.auth?.isAuthenticated()) {
        html += `
            <button class="btn btn-primary" onclick="showAddReviewModal()">📝 Оставить отзыв</button>
        `;
    }
    
    if (reviews.length === 0) {
        html += '<div class="card text-center">Пока нет отзывов</div>';
    } else {
        html += '<h3>Все отзывы</h3>';
        
        reviews.forEach(review => {
            html += `
                <div class="review-card">
                    <div class="review-header">
                        <span class="review-order">${review.order_number === 'GENERAL' ? 'Отзыв' : 'Заказ ' + escapeHtml(review.order_number)}</span>
                        <span class="review-date">${escapeHtml(review.date)}</span>
                    </div>
                    <div class="review-rating">${'⭐'.repeat(review.rating)}</div>
                    ${review.text ? `<div class="review-text">${escapeHtml(review.text)}</div>` : ''}
                    <div class="review-id">ID: ${escapeHtml(review.short_id || 'Аноним')}</div>
                </div>
            `;
        });
    }
    
    html += `<div class="text-gray text-sm text-center mt-20">Последнее обновление: ${escapeHtml(data.last_updated)}</div>`;
    
    if (mainContent) {
        mainContent.innerHTML = html;
    }
}

// Показ модалки добавления отзыва
function showAddReviewModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Оставить отзыв</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Оценка</label>
                    <div class="rating-selector" id="reviewRating">
                        ${[1,2,3,4,5].map(r => `<span class="star" data-rating="${r}">☆</span>`).join('')}
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Ваш отзыв</label>
                    <textarea class="form-input" id="reviewText" rows="4" placeholder="Напишите пару слов о качестве обслуживания..."></textarea>
                </div>
                <button class="btn btn-primary" onclick="addReview()">Отправить</button>
            </div>
        </div>
    `;
    
    const modalContainer = document.getElementById('modalContainer');
    if (modalContainer) {
        modalContainer.appendChild(modal);
    }
    
    // Настройка звезд
    let selectedRating = null;
    const stars = modal.querySelectorAll('.rating-selector .star');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.dataset.rating);
            selectedRating = rating;
            stars.forEach((s, i) => {
                if (i < rating) {
                    s.textContent = '★';
                    s.style.color = '#FFD700';
                } else {
                    s.textContent = '☆';
                    s.style.color = '#ddd';
                }
            });
        });
    });
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
    
    window.addReview = async function() {
        if (!selectedRating) {
            showToast('Поставьте оценку', 'error');
            return;
        }
        
        const text = document.getElementById('reviewText')?.value || '';
        
        const response = await api.post('/api/reviews/add', {
            order_number: 'GENERAL',
            rating: selectedRating,
            text: text
        });
        
        if (response.ok) {
            showToast('Спасибо за отзыв!', 'success');
            modal.remove();
            loadReviewsPage();
        } else {
            showToast(response.data.error || 'Ошибка', 'error');
        }
    };
}

// ==================== СТРАНИЦА БОНУСОВ ====================

async function loadBonusesPage() {
    const mainContent = document.getElementById('mainContent');
    
    const response = await api.get('/api/bonus/balance');
    
    if (!response.ok) {
        if (mainContent) {
            mainContent.innerHTML = '<div class="error">Ошибка загрузки бонусов</div>';
        }
        return;
    }
    
    const data = response.data;
    const rubEquivalent = Math.floor(data.balance);
    
    let html = `
        <div class="bonus-card">
            <div>Ваш баланс</div>
            <div class="bonus-amount">${data.balance} 💎</div>
            <div class="bonus-equivalent">≈ ${rubEquivalent} ₽ скидки</div>
        </div>
        
        <div class="card">
            <h3>Как это работает?</h3>
            <p>• За каждый заказ начисляется 10% бонусами</p>
            <p>• 1 бонус = 1 рубль скидки</p>
            <p>• Можно списать до 50% от стоимости заказа</p>
        </div>
    `;
    
    if (data.history && data.history.length > 0) {
        html += '<div class="card"><h3>История операций</h3>';
        
        data.history.forEach(item => {
            const date = item.created_at ? new Date(item.created_at).toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            }) : '';
            
            html += `
                <div class="bonus-history-item">
                    <div>
                        <span class="${item.type === 'earn' ? 'bonus-history-earn' : 'bonus-history-spend'}">
                            ${item.type === 'earn' ? '+' : '-'}${item.amount} 💎
                        </span>
                        <div class="text-sm text-gray">${escapeHtml(item.description || '')}</div>
                    </div>
                    <div class="text-sm text-gray">${date}</div>
                </div>
            `;
        });
        
        html += '</div>';
    }
    
    if (mainContent) {
        mainContent.innerHTML = html;
    }
}

// ==================== СТРАНИЦА ПРОФИЛЯ ====================

async function loadProfilePage() {
    const user = window.auth?.getCurrentUser();
    const mainContent = document.getElementById('mainContent');
    
    if (!user) {
        if (mainContent) {
            mainContent.innerHTML = '<div class="card">Пожалуйста, войдите в систему</div>';
        }
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
            
            <div class="profile-field">
                <div class="profile-field-label">Дата регистрации</div>
                <div class="profile-field-value">${user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : 'Не указано'}</div>
            </div>
            
            <div class="profile-field">
                <div class="profile-field-label">Баланс бонусов</div>
                <div class="profile-field-value">${user.bonus_balance || 0} 💎</div>
            </div>
            
            <button class="btn btn-danger" onclick="window.auth?.logout()">🚪 Выйти</button>
        `;
    }
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
                <input type="text" class="form-input" id="editValue" value="${escapeHtml(user[field] || '')}">
                <button class="btn btn-primary" onclick="saveField('${field}')">Сохранить</button>
            </div>
        </div>
    `;
    
    const modalContainer = document.getElementById('modalContainer');
    if (modalContainer) {
        modalContainer.appendChild(modal);
    }
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
}

// Сохранение поля
async function saveField(field) {
    const value = document.getElementById('editValue')?.value;
    if (!value) {
        showToast('Введите значение', 'error');
        return;
    }
    
    const success = await window.auth?.updateProfile(field, value);
    if (success) {
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            modalContainer.innerHTML = '';
        }
        loadProfilePage();
    }
}

// ==================== АДМИН-ПАНЕЛЬ ====================

async function loadAdminPage() {
    const mainContent = document.getElementById('mainContent');
    
    // Проверка прав администратора
    if (!window.auth?.isAdmin()) {
        if (mainContent) {
            mainContent.innerHTML = '<div class="error">Доступ запрещен. Только для администратора.</div>';
        }
        return;
    }
    
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="card">
                <h3>🔧 Админ-панель</h3>
                <div class="admin-tabs" style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn btn-small" onclick="loadAdminOrders()">📦 Заказы</button>
                    <button class="btn btn-small" onclick="loadAdminUsers()">👥 Пользователи</button>
                    <button class="btn btn-small" onclick="loadAdminStats()">📊 Статистика</button>
                </div>
            </div>
            <div id="adminContent"></div>
        `;
    }
    
    // Загружаем заказы по умолчанию
    loadAdminOrders();
}

async function loadAdminOrders() {
    const container = document.getElementById('adminContent');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    
    const response = await api.get('/api/admin/orders');
    
    if (!response.ok) {
        container.innerHTML = '<div class="error">Ошибка загрузки</div>';
        return;
    }
    
    const orders = response.data;
    
    if (!orders || orders.length === 0) {
        container.innerHTML = '<div class="card">Нет заказов</div>';
        return;
    }
    
    let html = '<h3>Все заказы</h3>';
    
    orders.forEach(order => {
        const statusClass = {
            'новый': 'new',
            'выполнен': 'completed',
            'отменен': 'cancelled'
        }[order.status] || '';
        
        html += `
            <div class="order-card">
                <div class="order-header">
                    <span class="order-number">${escapeHtml(order.number)}</span>
                    <span class="order-status ${statusClass}">${order.status}</span>
                </div>
                <div class="order-detail">👤 ${escapeHtml(order.name)} (${escapeHtml(order.short_id)})</div>
                <div class="order-detail">📱 ${escapeHtml(order.phone)}</div>
                <div class="order-detail">📍 ${escapeHtml(order.address)}</div>
                <div class="order-detail">🕐 ${escapeHtml(order.exact_time)}</div>
                <div class="order-detail">📦 ${order.bags} пак. | ${order.amount}₽</div>
                ${order.final_amount !== order.amount ? `
                    <div class="order-detail">💎 Итого: ${order.final_amount}₽ (бонусы: ${order.bonus_used})</div>
                ` : ''}
                <div class="order-detail">💳 ${order.payment}</div>
                
                <div class="admin-actions" style="display: flex; gap: 10px; margin-top: 10px;">
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
    
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    
    const response = await api.get('/api/admin/users');
    
    if (!response.ok) {
        container.innerHTML = '<div class="error">Ошибка загрузки</div>';
        return;
    }
    
    const users = response.data;
    
    let html = '<h3>Пользователи</h3>';
    
    users.forEach(user => {
        html += `
            <div class="card">
                <div><strong>${escapeHtml(user.name)}</strong> (${escapeHtml(user.short_id)})</div>
                <div>📱 ${escapeHtml(user.phone || 'нет')}</div>
                <div>📍 ${escapeHtml(user.address || 'нет')}</div>
                <div>💎 Баланс: ${user.bonus_balance || 0}</div>
                <div>📅 ${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'неизвестно'}</div>
                <button class="btn btn-small" onclick="showAddBonusModal('${user.user_id}', '${escapeHtml(user.name)}')">➕ Добавить бонусы</button>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

async function loadAdminStats() {
    const container = document.getElementById('adminContent');
    if (!container) return;
    
    const ordersRes = await api.get('/api/admin/orders');
    const usersRes = await api.get('/api/admin/users');
    
    if (!ordersRes.ok || !usersRes.ok) {
        container.innerHTML = '<div class="error">Ошибка загрузки</div>';
        return;
    }
    
    const orders = ordersRes.data;
    const users = usersRes.data;
    
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'выполнен').length;
    const cancelledOrders = orders.filter(o => o.status === 'отменен').length;
    const activeOrders = orders.filter(o => o.status === 'новый').length;
    
    const totalRevenue = orders
        .filter(o => o.status === 'выполнен')
        .reduce((sum, o) => sum + (o.final_amount || o.amount), 0);
    
    container.innerHTML = `
        <div class="card">
            <h3>📊 Статистика</h3>
            <h4>📦 Заказы</h4>
            <p>Всего: ${totalOrders}</p>
            <p>✅ Выполнено: ${completedOrders}</p>
            <p>❌ Отменено: ${cancelledOrders}</p>
            <p>🆕 Активных: ${activeOrders}</p>
            <h4>💰 Финансы</h4>
            <p>Выручка: ${totalRevenue} ₽</p>
            <p>Средний чек: ${completedOrders ? Math.round(totalRevenue / completedOrders) : 0} ₽</p>
            <h4>👥 Пользователи</h4>
            <p>Всего: ${users.length}</p>
        </div>
    `;
}

function showAddBonusModal(userId, userName) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Добавить бонусы</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>Пользователь: <strong>${escapeHtml(userName)}</strong></p>
                <div class="form-group">
                    <label class="form-label">Количество бонусов</label>
                    <input type="number" class="form-input" id="bonusAmount" min="1" value="100">
                </div>
                <button class="btn btn-primary" onclick="addBonus('${userId}')">Добавить</button>
            </div>
        </div>
    `;
    
    const modalContainer = document.getElementById('modalContainer');
    if (modalContainer) {
        modalContainer.appendChild(modal);
    }
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
}

async function addBonus(userId) {
    const amount = document.getElementById('bonusAmount')?.value;
    if (!amount || amount < 1) {
        showToast('Введите корректное число', 'error');
        return;
    }
    
    const response = await api.post('/api/admin/bonus/add', {
        user_id: userId,
        amount: parseInt(amount)
    });
    
    if (response.ok) {
        showToast(`Добавлено ${amount} бонусов`, 'success');
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            modalContainer.innerHTML = '';
        }
        loadAdminUsers();
    } else {
        showToast(response.data.error || 'Ошибка', 'error');
    }
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

// ==================== УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ ====================

// Переключение бокового меню
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

// Утилита для экранирования HTML
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Экспорт глобальных функций
window.showAuthModal = showAuthModal;
window.createOrder = createOrder;
window.selectBags = selectBags;
window.editField = editField;
window.saveField = saveField;
window.loadPage = loadPage;
window.showAddReviewModal = showAddReviewModal;
window.showOrderDetails = showOrderDetails;
window.loadAdminOrders = loadAdminOrders;
window.loadAdminUsers = loadAdminUsers;
window.loadAdminStats = loadAdminStats;
window.updateOrderStatus = updateOrderStatus;
window.showAddBonusModal = showAddBonusModal;
window.addBonus = addBonus;
window.toggleSidebar = toggleSidebar;
window.escapeHtml = escapeHtml;
