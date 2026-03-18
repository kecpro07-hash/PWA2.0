// Загрузка страницы профиля
async function loadProfilePage() {
    const content = document.getElementById('mainContent');
    
    if (!currentUser) {
        content.innerHTML = '<div class="card">Пожалуйста, войдите в систему</div>';
        return;
    }
    
    content.innerHTML = `
        <div class="profile-header">
            <div class="profile-avatar">👤</div>
            <div class="profile-name">${currentUser.name}</div>
            <div class="profile-id">ID: ${currentUser.short_id}</div>
        </div>
        
        <div class="profile-field" onclick="editField('name')">
            <div class="profile-field-label">Имя</div>
            <div class="profile-field-value">${currentUser.name || 'Не указано'}</div>
        </div>
        
        <div class="profile-field" onclick="editField('phone')">
            <div class="profile-field-label">Телефон</div>
            <div class="profile-field-value">${currentUser.phone || 'Не указано'}</div>
        </div>
        
        <div class="profile-field" onclick="editField('address')">
            <div class="profile-field-label">Адрес</div>
            <div class="profile-field-value">${currentUser.address || 'Не указано'}</div>
        </div>
        
        <div class="profile-field">
            <div class="profile-field-label">Дата регистрации</div>
            <div class="profile-field-value">${new Date(currentUser.created_at).toLocaleDateString('ru-RU')}</div>
        </div>
        
        <button class="btn btn-danger" onclick="confirmDeleteAccount()">Удалить аккаунт</button>
    `;
}

// Редактирование поля
function editField(field) {
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
                <div class="form-group">
                    <input type="text" class="form-input" id="editValue" value="${currentUser[field] || ''}" placeholder="${fieldNames[field]}">
                </div>
                <button class="btn btn-primary" onclick="saveField('${field}')">Сохранить</button>
            </div>
        </div>
    `;
    
    document.getElementById('modalContainer').appendChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });
}

// Сохранение поля
async function saveField(field) {
    const value = document.getElementById('editValue').value;
    
    if (!value) {
        showToast('Введите значение', 'error');
        return;
    }
    
    const updateData = {};
    updateData[field] = value;
    
    const response = await api.put('/api/user/update', updateData);
    
    if (response.ok) {
        currentUser[field] = value;
        updateUserInfo();
        document.getElementById('modalContainer').innerHTML = '';
        loadProfilePage();
        showToast('Данные сохранены', 'success');
    } else {
        showToast(response.data.error || 'Ошибка', 'error');
    }
}

// Подтверждение удаления аккаунта
function confirmDeleteAccount() {
    showConfirm('Вы уверены, что хотите удалить аккаунт? Это действие нельзя отменить!')
        .then(confirmed => {
            if (confirmed) {
                deleteAccount();
            }
        });
}

// Удаление аккаунта
async function deleteAccount() {
    // Здесь будет API для удаления
    showToast('Функция в разработке', 'warning');
}
