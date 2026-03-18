// Загрузка страницы отзывов
async function loadReviewsPage() {
    const content = document.getElementById('mainContent');
    
    const response = await api.get('/api/reviews');
    
    if (!response.ok) {
        content.innerHTML = '<div class="error">Ошибка загрузки отзывов</div>';
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
    
    if (currentUser) {
        html += `
            <button class="btn btn-primary" onclick="showAddReviewModal()">📝 Оставить отзыв</button>
        `;
    }
    
    if (reviews.length === 0) {
        html += '<div class="card text-center">Пока нет отзывов</div>';
    } else {
        html += '<h3>Последние отзывы</h3>';
        
        reviews.forEach(review => {
            html += `
                <div class="review-card">
                    <div class="review-header">
                        <span class="review-order">${review.order_number === 'GENERAL' ? 'Отзыв' : 'Заказ ' + review.order_number}</span>
                        <span class="review-date">${review.date}</span>
                    </div>
                    <div class="review-rating">${'⭐'.repeat(review.rating)}</div>
                    ${review.text ? `<div class="review-text">${review.text}</div>` : ''}
                    <div class="review-id">ID: ${review.short_id || 'Аноним'}</div>
                </div>
            `;
        });
    }
    
    html += `<div class="text-gray text-sm text-center mt-20">Последнее обновление: ${data.last_updated}</div>`;
    
    content.innerHTML = html;
}

// Показ модального окна добавления отзыва
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
    
    document.getElementById('modalContainer').appendChild(modal);
    
    // Настройка звезд
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
            window.reviewRating = rating;
        });
    });
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
}

// Добавление отзыва
async function addReview() {
    const rating = window.reviewRating;
    const text = document.getElementById('reviewText').value;
    
    if (!rating) {
        showToast('Поставьте оценку', 'error');
        return;
    }
    
    const response = await api.post('/api/reviews/add', {
        order_number: 'GENERAL',
        rating: parseInt(rating),
        text: text
    });
    
    if (response.ok) {
        showToast('Спасибо за отзыв!', 'success');
        document.getElementById('modalContainer').innerHTML = '';
        loadReviewsPage();
    } else {
        showToast(response.data.error || 'Ошибка', 'error');
    }
}
