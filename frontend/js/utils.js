// Утилиты

// Форматирование даты
function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Форматирование телефона
function formatPhone(phone) {
    if (!phone) return '';
    // Очищаем от всего кроме цифр
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 11) {
        return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9, 11)}`;
    }
    return phone;
}

// Валидация телефона
function validatePhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 11;
}

// Валидация email - строка 147 где-то здесь
function validateEmail(email) {
    // !!! ВАЖНО: слэши должны быть в начале и в конце !!!
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;  // ← проверьте эту строку
    return re.test(email);
}

// Генерация случайного ID
function generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Дебаунс (для поиска)
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Троттлинг (для скролла)
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Копирование в буфер обмена
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Скопировано!', 'success');
        return true;
    } catch (err) {
        console.error('Failed to copy:', err);
        return false;
    }
}

// Скачивание файла
function downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Экспорт в CSV
function exportToCSV(data, filename) {
    if (!data || !data.length) return;
    
    const headers = Object.keys(data[0]);
    const csv = [
        headers.join(';'),
        ...data.map(row => headers.map(h => row[h]).join(';'))
    ].join('\n');
    
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}

// Получение параметров из URL
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
}

// Обновление URL без перезагрузки
function updateUrl(params, replace = false) {
    const url = new URL(window.location);
    
    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined || value === '') {
            url.searchParams.delete(key);
        } else {
            url.searchParams.set(key, value);
        }
    }
    
    if (replace) {
        window.history.replaceState({}, '', url);
    } else {
        window.history.pushState({}, '', url);
    }
}

// Проверка поддержки touch
function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Определение платформы
function getPlatform() {
    const ua = navigator.userAgent;
    if (ua.match(/android/i)) return 'android';
    if (ua.match(/iphone|ipad|ipod/i)) return 'ios';
    if (ua.match(/windows/i)) return 'windows';
    if (ua.match(/mac/i)) return 'mac';
    return 'other';
}

// Показ уведомления (если функция не определена в app.js)
if (typeof showToast !== 'function') {
    window.showToast = function(message, type = 'info', duration = 3000) {
        console.log(`[${type}] ${message}`);
        alert(message); // временно, пока не появится нормальный showToast
    };
}
