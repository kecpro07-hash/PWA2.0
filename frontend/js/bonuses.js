// Загрузка страницы бонусов
async function loadBonusesPage() {
    const content = document.getElementById('mainContent');
    
    const response = await api.get('/api/bonus/balance');
    
    if (!response.ok) {
        content.innerHTML = '<div class="error">Ошибка загрузки бонусов</div>';
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
            const date = new Date(item.created_at).toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            
            html += `
                <div class="bonus-history-item">
                    <div>
                        <span class="${item.type === 'earn' ? 'bonus-history-earn' : 'bonus-history-spend'}">
                            ${item.type === 'earn' ? '+' : '-'}${item.amount} 💎
                        </span>
                        <div class="text-sm text-gray">${item.description || ''}</div>
                    </div>
                    <div class="text-sm text-gray">${date}</div>
                </div>
            `;
        });
        
        html += '</div>';
    }
    
    content.innerHTML = html;
}
