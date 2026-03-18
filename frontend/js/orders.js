// Загрузка страницы заказов
async function loadOrdersPage() {
    const content = document.getElementById('mainContent');
    
    const response = await api.get('/api/orders');
    
    if (!response.ok) {
        content.innerHTML = '<div class="error">Ошибка загрузки заказов</div>';
        return;
    }
    
    const orders = response.data;
    
    if (orders.length === 0) {
        content.innerHTML = `
            <div class="card text-center">
                <h3>📭 У вас пока нет заказов</h3>
                <p>Сделайте первый заказ на главной странице</p>
                <button class="btn btn-primary" onclick="loadPage('main')">На главную</button>
            </div>
        `;
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
                    <span class="order-number">Заказ ${order.number}</span>
                    <span class="order-status ${statusClass}">${statusText}</span>
                </div>
                <div class="order-detail">
                    <span class="order-detail-icon">🕐</span>
                    <span>${order.exact_time}</span>
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
    
    content.innerHTML = html;
}

// Показ деталей заказа
async function showOrderDetails(orderNumber) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    // Получаем детали заказа
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
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Заказ ${order.number}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="card">
                    <p><strong>Статус:</strong> <span class="order-status ${statusClass}">${statusText}</span></p>
                    <p><strong>Время:</strong> ${order.exact_time}</p>
                    <p><strong>Пакетов:</strong> ${order.bags}</p>
                    <p><strong>Адрес:</strong> ${order.address}</p>
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
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    document.getElementById('modalContainer').appendChild(modal);
    
    // Настройка звезд для рейтинга
    const stars = modal.querySelectorAll('.rating-selector .star');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = star.dataset.rating;
            stars.forEach((s, i) => {
                if (i < rating) {
                    s.textContent = '★';
                    s.style.color = '#FFD700';
                } else {
                    s.textContent = '☆';
                    s.style.color = '#ddd';
                }
            });
            window.selectedRating = rating;
        });
    });
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
}

// Отправка отзыва
async function submitReview(orderNumber) {
    const rating = window.selectedRating;
    const text = document.getElementById('reviewText').value;
    
    if (!rating) {
        showToast('Поставьте оценку', 'error');
        return;
    }
    
    const response = await api.post('/api/reviews/add', {
        order_number: orderNumber,
        rating: parseInt(rating),
        text: text
    });
    
    if (response.ok) {
        showToast('Спасибо за отзыв!', 'success');
        document.getElementById('modalContainer').innerHTML = '';
        loadOrdersPage();
    } else {
        showToast(response.data.error || 'Ошибка', 'error');
    }
}
