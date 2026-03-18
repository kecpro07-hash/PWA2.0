// Загрузка админ-панели
async function loadAdminPage() {
    const content = document.getElementById('mainContent');
    
    // Проверка прав
    if (!currentUser || currentUser.user_id !== ADMIN_ID) {
        content.innerHTML = '<div class="error">Доступ запрещен</div>';
        return;
    }
    
    content.innerHTML = `
        <div class="card">
            <h3>🔧 Админ-панель</h3>
            <div class="admin-tabs">
                <button class="btn btn-small" onclick="loadAdminOrders()">📦 Заказы</button>
                <button class="btn btn-small" onclick="loadAdminUsers()">👥 Пользователи</button>
                <button class="btn btn-small" onclick="loadAdminStats()">📊 Статистика</button>
                <button class="btn btn-small" onclick="loadAdminBonuses()">💎 Бонусы</button>
            </div>
        </div>
        <div id="adminContent"></div>
    `;
    
    // Загружаем заказы по умолчанию
    loadAdminOrders();
}

// Загрузка заказов для админа
async function loadAdminOrders() {
    const container = document.getElementById('adminContent');
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    
    const response = await api.get('/api/admin/orders');
    
    if (!response.ok) {
        container.innerHTML = '<div class="error">Ошибка загрузки</div>';
        return;
    }
    
    const orders = response.data;
    
    if (orders.length === 0) {
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
                    <span class="order-number">${order.number}</span>
                    <span class="order-status ${statusClass}">${order.status}</span>
                </div>
                <div class="order-detail">👤 ${order.name} (${order.short_id})</div>
                <div class="order-detail">📱 ${order.phone}</div>
                <div class="order-detail">📍 ${order.address}</div>
                <div class="order-detail">🕐 ${order.exact_time}</div>
                <div class="order-detail">📦 ${order.bags} пак. | ${order.amount}₽</div>
                ${order.final_amount !== order.amount ? `
                    <div class="order-detail">💎 Итого: ${order.final_amount}₽ (бонусы: ${order.bonus_used})</div>
                ` : ''}
                <div class="order-detail">💳 ${order.payment}</div>
                
                <div class="admin-actions">
                    <button class="btn btn-small btn-success" onclick="updateOrderStatus('${order.number}', 'выполнен')">✅ Выполнен</button>
                    <button class="btn btn-small btn-danger" onclick="updateOrderStatus('${order.number}', 'отменен')">❌ Отменен</button>
                    ${order.status === 'новый' ? `
                        <button class="btn btn-small" onclick="requestPayment('${order.number}')">💰 Запросить оплату</button>
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
        showToast(`Статус заказа ${orderNumber} изменен`, 'success');
        loadAdminOrders();
    } else {
        showToast('Ошибка', 'error');
    }
}

// Запрос оплаты
function requestPayment(orderNumber) {
    // Здесь будет интеграция с платежной системой
    showToast('Функция в разработке', 'warning');
}

// Загрузка пользователей для админа
async function loadAdminUsers() {
    const container = document.getElementById('adminContent');
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
                <div><strong>${user.name}</strong> (${user.short_id})</div>
                <div>📱 ${user.phone || 'нет'}</div>
                <div>📍 ${user.address || 'нет'}</div>
                <div>💎 Баланс: ${user.bonus_balance || 0}</div>
                <div>📅 ${new Date(user.created_at).toLocaleDateString()}</div>
                <button class="btn btn-small" onclick="showAddBonusModal('${user.user_id}', '${user.name}')">➕ Добавить бонусы</button>
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
                <p>Пользователь: <strong>${userName}</strong></p>
                <div class="form-group">
                    <label class="form-label">Количество бонусов</label>
                    <input type="number" class="form-input" id="bonusAmount" min="1" value="100">
                </div>
                <button class="btn btn-primary" onclick="addBonus('${userId}')">Добавить</button>
            </div>
        </div>
    `;
    
    document.getElementById('modalContainer').appendChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
}

// Добавление бонусов
async function addBonus(userId) {
    const amount = document.getElementById('bonusAmount').value;
    
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
        document.getElementById('modalContainer').innerHTML = '';
        loadAdminUsers();
    } else {
        showToast(response.data.error || 'Ошибка', 'error');
    }
}

// Загрузка статистики
async function loadAdminStats() {
    const container = document.getElementById('adminContent');
    
    // Получаем данные
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
            
            <h4>💎 Бонусы</h4>
            <p>Всего списано: ${totalBonusesSpent} 💎</p>
            
            <h4>👥 Пользователи</h4>
            <p>Всего: ${users.length}</p>
        </div>
    `;
}

// Загрузка управления бонусами
function loadAdminBonuses() {
    const container = document.getElementById('adminContent');
    
    container.innerHTML = `
        <div class="card">
            <h3>💎 Управление бонусами</h3>
            <p>Выберите пользователя в разделе "Пользователи" для начисления бонусов</p>
        </div>
    `;
}
