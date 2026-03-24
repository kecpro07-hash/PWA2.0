// ==================== АДМИН-ПАНЕЛЬ С УВЕДОМЛЕНИЯМИ ====================

// WebSocket соединение для админа
let adminSocket = null;
let notificationSound = null;

// Загрузка админ-панели
async function loadAdminPage() {
    const content = document.getElementById('mainContent');
    
    // Проверка прав
    const user = window.auth?.getCurrentUser();
    const isAdmin = user && user.user_id === CONFIG?.ADMIN_ID;
    
    if (!isAdmin) {
        content.innerHTML = '<div class="error">Доступ запрещен</div>';
        return;
    }
    
    content.innerHTML = `
        <div class="card">
            <h3>🔧 Админ-панель</h3>
            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 15px;">
                <button class="btn btn-small" onclick="loadAdminOrders()">📦 Заказы</button>
                <button class="btn btn-small" onclick="loadAdminUsers()">👥 Пользователи</button>
                <button class="btn btn-small" onclick="loadAdminStats()">📊 Статистика</button>
                <button class="btn btn-small" onclick="loadAdminBonuses()">💎 Бонусы</button>
            </div>
            <div id="adminNotification" style="display: none; background: #fff3cd; border: 1px solid #ffc107; border-radius: 10px; padding: 10px; margin-top: 10px;">
                🔔 <span id="adminNotificationText"></span>
            </div>
        </div>
        <div id="adminContent"></div>
    `;
    
    // Подключаем WebSocket для получения уведомлений
    connectAdminWebSocket();
    
    // Создаем звук уведомления
    notificationSound = new Audio('data:audio/wav;base64,U3RlYWx0aCB3YXZlIGZvcm0gLSBzb3VuZA==');
    
    // Загружаем заказы по умолчанию
    loadAdminOrders();
}

// Подключение WebSocket для админа
function connectAdminWebSocket() {
    if (adminSocket && adminSocket.readyState === WebSocket.OPEN) {
        console.log('WebSocket уже подключен');
        return;
    }
    
    const token = localStorage.getItem('auth_token');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/socket.io/?EIO=4&transport=websocket`;
    
    try {
        adminSocket = new WebSocket(wsUrl);
        
        adminSocket.onopen = () => {
            console.log('🔌 WebSocket подключен (админ-режим)');
            // Отправляем сообщение о подключении к админ-комнате
            adminSocket.send(JSON.stringify({
                type: 'join_admin',
                token: token
            }));
        };
        
        adminSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📩 WebSocket сообщение:', data);
                
                if (data.type === 'new_order' || (data[0] && data[0] === 'new_order')) {
                    // Обработка нового заказа
                    const orderData = data.type === 'new_order' ? data : data[1];
                    showNewOrderNotification(orderData);
                }
            } catch (e) {
                // Пробуем распарсить как обычный JSON
                try {
                    const parsed = JSON.parse(event.data);
                    if (parsed.type === 'new_order' || (parsed[0] && parsed[0] === 'new_order')) {
                        const orderData = parsed.type === 'new_order' ? parsed : parsed[1];
                        showNewOrderNotification(orderData);
                    }
                } catch (err) {
                    console.log('WebSocket сообщение:', event.data);
                }
            }
        };
        
        adminSocket.onclose = () => {
            console.log('🔌 WebSocket отключен, переподключение через 5 сек...');
            setTimeout(connectAdminWebSocket, 5000);
        };
        
        adminSocket.onerror = (error) => {
            console.error('WebSocket ошибка:', error);
        };
        
    } catch (error) {
        console.error('Ошибка подключения WebSocket:', error);
    }
}

// Показ уведомления о новом заказе
function showNewOrderNotification(order) {
    console.log('🔔 НОВЫЙ ЗАКАЗ!', order);
    
    // Показываем уведомление в админ-панели
    const notificationDiv = document.getElementById('adminNotification');
    const notificationText = document.getElementById('adminNotificationText');
    
    if (notificationDiv && notificationText) {
        notificationText.innerHTML = `
            🎫 <strong>Новый заказ #${order.order_number || order.number}</strong><br>
            👤 ${order.name}<br>
            📦 ${order.bags || order.bags_count} пак. | ${order.amount || order.final_amount}₽<br>
            🕐 ${order.time || order.exact_time}
        `;
        notificationDiv.style.display = 'block';
        
        // Скрываем через 10 секунд
        setTimeout(() => {
            notificationDiv.style.display = 'none';
        }, 10000);
    }
    
    // Воспроизводим звук уведомления
    if (notificationSound) {
        notificationSound.play().catch(e => console.log('Звук не воспроизведен'));
    }
    
    // Браузерное уведомление
    if (Notification.permission === 'granted') {
        new Notification('🔔 Новый заказ!', {
            body: `Заказ #${order.order_number || order.number} от ${order.name} на сумму ${order.amount || order.final_amount}₽`,
            icon: '/icons/icon-192x192.png',
            tag: 'new-order'
        });
    }
    
    // Обновляем список заказов
    if (currentAdminTab === 'orders') {
        loadAdminOrders();
    }
}

// Текущая вкладка админки
let currentAdminTab = 'orders';

// Загрузка заказов для админа
async function loadAdminOrders() {
    currentAdminTab = 'orders';
    const container = document.getElementById('adminContent');
    if (!container) return;
    
    container.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Загрузка...</p></div>';
    
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
        
        const statusText = {
            'новый': '🆕 Новый',
            'выполнен': '✅ Выполнен',
            'отменен': '❌ Отменен'
        }[order.status] || order.status;
        
        html += `
            <div class="order-card" id="order-${order.number}">
                <div class="order-header">
                    <span class="order-number">🎫 ${escapeHtml(order.number)}</span>
                    <span class="order-status ${statusClass}">${statusText}</span>
                </div>
                <div class="order-detail">👤 ${escapeHtml(order.name)} (${escapeHtml(order.short_id)})</div>
                <div class="order-detail">📱 ${escapeHtml(order.phone || 'нет')}</div>
                <div class="order-detail">📍 ${escapeHtml(order.address)}</div>
                <div class="order-detail">🕐 ${escapeHtml(order.exact_time)}</div>
                <div class="order-detail">📦 ${order.bags} пак. | ${order.amount}₽</div>
                ${order.final_amount !== order.amount ? `
                    <div class="order-detail">💎 Итого: ${order.final_amount}₽ (бонусы: ${order.bonus_used})</div>
                ` : ''}
                <div class="order-detail">💳 ${order.payment === 'оплачен' ? '✅ Оплачено' : '⏳ Ожидает'}</div>
                
                <div class="admin-actions" style="margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn btn-small btn-success" onclick="updateOrderStatus('${order.number}', 'выполнен')">✅ Выполнен</button>
                    <button class="btn btn-small btn-danger" onclick="updateOrderStatus('${order.number}', 'отменен')">❌ Отменен</button>
                    ${order.status === 'новый' ? `
                        <button class="btn btn-small" onclick="requestPayment('${order.number}', ${order.final_amount || order.amount})">💰 Запросить оплату</button>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Обновление статуса заказа
async function updateOrderStatus(orderNumber, status) {
    const response = await api.put(`/api/admin/order/${orderNumber}/status`, { status });
    
    if (response.ok) {
        showToast(`Статус заказа ${orderNumber} изменен на "${status}"`, 'success');
        loadAdminOrders();
    } else {
        showToast(response.data.error || 'Ошибка', 'error');
    }
}

// Запрос оплаты
function requestPayment(orderNumber, amount) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Запрос оплаты</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>Заказ: <strong>${orderNumber}</strong></p>
                <p>Сумма: <strong>${amount}₽</strong></p>
                <div class="form-group">
                    <label class="form-label">СБП (Ссылка для оплаты)</label>
                    <input type="text" class="form-input" id="paymentLink" value="https://sbp.ru/pay?order=${orderNumber}" readonly>
                    <button class="btn btn-small" onclick="copyToClipboard('${orderNumber}')">📋 Копировать ссылку</button>
                </div>
                <p class="text-sm text-gray mt-10">Отправьте ссылку клиенту в Telegram или SMS</p>
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

// Копирование ссылки
async function copyToClipboard(orderNumber) {
    const link = `https://sbp.ru/pay?order=${orderNumber}`;
    try {
        await navigator.clipboard.writeText(link);
        showToast('Ссылка скопирована', 'success');
    } catch (err) {
        showToast('Не удалось скопировать', 'error');
    }
}

// Загрузка пользователей для админа
async function loadAdminUsers() {
    currentAdminTab = 'users';
    const container = document.getElementById('adminContent');
    if (!container) return;
    
    container.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Загрузка...</p></div>';
    
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

// Показ модального окна добавления бонусов
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

// Добавление бонусов
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

// Загрузка статистики
async function loadAdminStats() {
    currentAdminTab = 'stats';
    const container = document.getElementById('adminContent');
    if (!container) return;
    
    container.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Загрузка...</p></div>';
    
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
    
    const totalBonusesSpent = orders
        .reduce((sum, o) => sum + (o.bonus_used || 0), 0);
    
    const today = new Date();
    const todayOrders = orders.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate.toDateString() === today.toDateString();
    }).length;
    
    container.innerHTML = `
        <div class="card">
            <h3>📊 Статистика</h3>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0;">
                <div class="stat-item" style="background: #e3f2fd; padding: 15px; border-radius: 12px; text-align: center;">
                    <div class="stat-value" style="font-size: 28px; font-weight: bold; color: #1976d2;">${totalOrders}</div>
                    <div class="stat-label">Всего заказов</div>
                </div>
                <div class="stat-item" style="background: #e8f5e8; padding: 15px; border-radius: 12px; text-align: center;">
                    <div class="stat-value" style="font-size: 28px; font-weight: bold; color: #2e7d32;">${activeOrders}</div>
                    <div class="stat-label">Активных</div>
                </div>
                <div class="stat-item" style="background: #fff3e0; padding: 15px; border-radius: 12px; text-align: center;">
                    <div class="stat-value" style="font-size: 28px; font-weight: bold; color: #f57c00;">${totalRevenue}</div>
                    <div class="stat-label">Выручка (₽)</div>
                </div>
                <div class="stat-item" style="background: #f3e5f5; padding: 15px; border-radius: 12px; text-align: center;">
                    <div class="stat-value" style="font-size: 28px; font-weight: bold; color: #7b1fa2;">${users.length}</div>
                    <div class="stat-label">Пользователей</div>
                </div>
            </div>
            
            <h4>📦 Подробно</h4>
            <p>✅ Выполнено: ${completedOrders}</p>
            <p>❌ Отменено: ${cancelledOrders}</p>
            <p>💰 Средний чек: ${completedOrders ? Math.round(totalRevenue / completedOrders) : 0} ₽</p>
            <p>💎 Всего списано бонусов: ${totalBonusesSpent} 💎</p>
            <p>📅 Заказов сегодня: ${todayOrders}</p>
        </div>
    `;
}

// Загрузка управления бонусами
function loadAdminBonuses() {
    currentAdminTab = 'bonuses';
    const container = document.getElementById('adminContent');
    if (!container) return;
    
    container.innerHTML = `
        <div class="card">
            <h3>💎 Управление бонусами</h3>
            <p>Выберите пользователя в разделе "Пользователи" для начисления бонусов</p>
            <hr>
            <h4>Правила начисления:</h4>
            <ul>
                <li>За выполненный заказ начисляется 10% от суммы</li>
                <li>1 бонус = 1 рубль скидки</li>
                <li>Максимум скидки 50% от заказа</li>
            </ul>
        </div>
    `;
}

// Запрос разрешения на уведомления
if (Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
        console.log('Уведомления:', permission);
        if (permission === 'granted') {
            // Регистрируем push-подписку
            registerPushSubscription();
        }
    });
}

// Регистрация push-подписки
async function registerPushSubscription() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array('ВАШ_VAPID_PUBLIC_KEY')
        });
        
        await api.post('/api/admin/push/subscribe', subscription);
        console.log('✅ Push-подписка зарегистрирована');
    } catch (error) {
        console.error('❌ Ошибка регистрации push:', error);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Эскпорт функций
window.loadAdminOrders = loadAdminOrders;
window.loadAdminUsers = loadAdminUsers;
window.loadAdminStats = loadAdminStats;
window.loadAdminBonuses = loadAdminBonuses;
window.updateOrderStatus = updateOrderStatus;
window.requestPayment = requestPayment;
window.showAddBonusModal = showAddBonusModal;
window.addBonus = addBonus;
window.copyToClipboard = copyToClipboard;

console.log('👑 Админ-панель загружена');
