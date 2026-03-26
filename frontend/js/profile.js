// ==================== ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ ====================

async function loadProfilePage() {
    const user = window.auth?.getCurrentUser();
    const mainContent = document.getElementById('mainContent');
    
    if (!user) {
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="card text-center">
                    <p>Войдите в систему</p>
                    <button class="btn btn-primary" onclick="window.showAuthModal()">Войти</button>
                </div>
            `;
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
            
            <div class="profile-field" onclick="window.showChangePasswordModal()">
                <div class="profile-field-label">Пароль</div>
                <div class="profile-field-value">••••••••</div>
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

// Экспорт функций
window.loadProfilePage = loadProfilePage;
window.editField = editField;
window.saveField = saveField;

console.log('👤 Профиль загружен');
