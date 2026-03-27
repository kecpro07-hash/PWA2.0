// ==================== УТИЛИТЫ ====================
// Все вспомогательные функции для PWA

// ==================== УВЕДОМЛЕНИЯ ====================

/**
 * Показ уведомления (тост)
 * @param {string} message - Текст уведомления
 * @param {string} type - Тип: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Длительность показа в мс
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    
    // Если контейнера нет, создаем его
    if (!container) {
        const newContainer = document.createElement('div');
        newContainer.id = 'toastContainer';
        newContainer.className = 'toast-container';
        document.body.appendChild(newContainer);
    }
    
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Иконки для разных типов
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close">&times;</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Анимация появления
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Кнопка закрытия
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        closeToast(toast);
    });
    
    // Автоматическое закрытие
    const timeout = setTimeout(() => {
        closeToast(toast);
    }, duration);
    
    // Сохраняем таймаут для возможности отмены
    toast.dataset.timeout = timeout;
    
    function closeToast(element) {
        clearTimeout(parseInt(element.dataset.timeout));
        element.style.opacity = '0';
        element.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }, 300);
    }
}

/**
 * Показ модального окна подтверждения
 * @param {string} message - Текст подтверждения
 * @returns {Promise<boolean>} - true если подтверждено, false если отменено
 */
function showConfirm(message) {
    return new Promise((resolve) => {
        // Проверяем, есть ли контейнер для модалок
        let modalContainer = document.getElementById('modalContainer');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'modalContainer';
            modalContainer.className = 'modal-container';
            document.body.appendChild(modalContainer);
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Подтверждение</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>${escapeHtml(message)}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="confirmNo">Отмена</button>
                    <button class="btn btn-primary" id="confirmYes">Да</button>
                </div>
            </div>
        `;
        
        modalContainer.appendChild(modal);
        
        // Функция закрытия
        const closeModal = (result) => {
            modal.style.opacity = '0';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
                resolve(result);
            }, 200);
        };
        
        // Обработчики
        modal.querySelector('.modal-close').addEventListener('click', () => closeModal(false));
        modal.querySelector('#confirmNo').addEventListener('click', () => closeModal(false));
        modal.querySelector('#confirmYes').addEventListener('click', () => closeModal(true));
        
        // Закрытие по клику вне модалки
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(false);
            }
        });
        
        // Анимация появления
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
    });
}

/**
 * Показ модального окна с формой
 * @param {string} title - Заголовок
 * @param {string} content - HTML содержимое
 * @param {Object} buttons - Кнопки {название: функция}
 * @returns {Promise<void>}
 */
function showModal(title, content, buttons = {}) {
    return new Promise((resolve) => {
        let modalContainer = document.getElementById('modalContainer');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'modalContainer';
            modalContainer.className = 'modal-container';
            document.body.appendChild(modalContainer);
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        let buttonsHtml = '';
        for (const [text, handler] of Object.entries(buttons)) {
            buttonsHtml += `<button class="btn btn-${text === 'Отмена' ? 'secondary' : 'primary'}" data-action="${text}">${escapeHtml(text)}</button>`;
        }
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${escapeHtml(title)}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    ${buttonsHtml}
                </div>
            </div>
        `;
        
        modalContainer.appendChild(modal);
        
        const closeModal = () => {
            modal.style.opacity = '0';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
                resolve();
            }, 200);
        };
        
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        
        for (const [text, handler] of Object.entries(buttons)) {
            const btn = modal.querySelector(`[data-action="${text}"]`);
            if (btn) {
                btn.addEventListener('click', async () => {
                    await handler(modal);
                    closeModal();
                });
            }
        }
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
    });
}

// ==================== ФОРМАТИРОВАНИЕ ====================

/**
 * Форматирование даты
 * @param {string|Date} date - Дата
 * @param {string} format - Формат (по умолчанию 'dd.mm.yyyy HH:MM')
 * @returns {string}
 */
function formatDate(date, format = 'dd.mm.yyyy HH:MM') {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Неверная дата';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return format
        .replace('dd', day)
        .replace('mm', month)
        .replace('yyyy', year)
        .replace('HH', hours)
        .replace('MM', minutes)
        .replace('SS', seconds);
}

/**
 * Форматирование телефона
 * @param {string} phone - Номер телефона
 * @returns {string}
 */
function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 11) {
        return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9, 11)}`;
    }
    if (cleaned.length === 10) {
        return `+7 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 8)}-${cleaned.slice(8, 10)}`;
    }
    return phone;
}

/**
 * Форматирование суммы
 * @param {number} amount - Сумма
 * @returns {string}
 */
function formatPrice(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Форматирование времени
 * @param {string|Date} date - Дата
 * @returns {string}
 */
function formatTime(date) {
    const d = new Date(date);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ==================== ВАЛИДАЦИЯ ====================

/**
 * Валидация телефона
 * @param {string} phone - Номер телефона
 * @returns {boolean}
 */
function validatePhone(phone) {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 11;
}

/**
 * Валидация email
 * @param {string} email - Email адрес
 * @returns {boolean}
 */
function validateEmail(email) {
    if (!email) return false;
    const re = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
    return re.test(email);
}

/**
 * Валидация имени
 * @param {string} name - Имя
 * @returns {boolean}
 */
function validateName(name) {
    if (!name) return false;
    return name.trim().length >= 2;
}

/**
 * Валидация адреса
 * @param {string} address - Адрес
 * @returns {boolean}
 */
function validateAddress(address) {
    if (!address) return false;
    return address.trim().length >= 5;
}

// ==================== ГЕНЕРАЦИЯ ====================

/**
 * Генерация случайного ID
 * @param {number} length - Длина ID
 * @returns {string}
 */
function generateId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Генерация случайного пароля
 * @param {number} length - Длина пароля
 * @returns {string}
 */
function generatePassword(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ==================== ОБРАБОТКА ДАННЫХ ====================

/**
 * Экранирование HTML для безопасности
 * @param {string} str - Строка для экранирования
 * @returns {string}
 */
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Обратное экранирование HTML
 * @param {string} str - Строка для восстановления
 * @returns {string}
 */
function unescapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

/**
 * Копирование текста в буфер обмена
 * @param {string} text - Текст для копирования
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Скопировано!', 'success');
        return true;
    } catch (err) {
        console.error('Failed to copy:', err);
        showToast('Не удалось скопировать', 'error');
        return false;
    }
}

// ==================== РАБОТА С ФАЙЛАМИ ====================

/**
 * Скачивание файла
 * @param {string} content - Содержимое файла
 * @param {string} filename - Имя файла
 * @param {string} type - MIME тип
 */
function downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Экспорт данных в CSV
 * @param {Array} data - Массив объектов
 * @param {string} filename - Имя файла
 */
function exportToCSV(data, filename) {
    if (!data || !data.length) {
        showToast('Нет данных для экспорта', 'warning');
        return;
    }
    
    const headers = Object.keys(data[0]);
    const csv = [
        headers.join(';'),
        ...data.map(row => headers.map(h => {
            let value = row[h];
            if (value === undefined || value === null) value = '';
            if (typeof value === 'string' && (value.includes(';') || value.includes('"'))) {
                value = `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(';'))
    ].join('\n');
    
    downloadFile('\uFEFF' + csv, filename, 'text/csv;charset=utf-8;');
}

/**
 * Чтение файла как текст
 * @param {File} file - Файл
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

// ==================== URL И НАВИГАЦИЯ ====================

/**
 * Получение параметров из URL
 * @returns {Object}
 */
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
}

/**
 * Обновление URL без перезагрузки
 * @param {Object} params - Параметры
 * @param {boolean} replace - Заменить историю
 */
function updateUrl(params, replace = false) {
    const url = new URL(window.location);
    
    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined || value === '') {
            url.searchParams.delete(key);
        } else {
            url.searchParams.set(key, String(value));
        }
    }
    
    if (replace) {
        window.history.replaceState({}, '', url);
    } else {
        window.history.pushState({}, '', url);
    }
}

// ==================== УСТРОЙСТВО ====================

/**
 * Проверка на touch устройство
 * @returns {boolean}
 */
function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Определение платформы
 * @returns {string}
 */
function getPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('mac')) return 'mac';
    if (ua.includes('linux')) return 'linux';
    return 'other';
}

/**
 * Проверка на мобильное устройство
 * @returns {boolean}
 */
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// ==================== ОПТИМИЗАЦИЯ ====================

/**
 * Дебаунс (задержка выполнения)
 * @param {Function} func - Функция
 * @param {number} wait - Задержка в мс
 * @returns {Function}
 */
function debounce(func, wait = 300) {
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

/**
 * Троттлинг (ограничение частоты)
 * @param {Function} func - Функция
 * @param {number} limit - Лимит в мс
 * @returns {Function}
 */
function throttle(func, limit = 300) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ==================== DOM ====================

/**
 * Создание элемента с классами
 * @param {string} tag - Тег
 * @param {string|string[]} classes - Классы
 * @param {Object} attributes - Атрибуты
 * @returns {HTMLElement}
 */
function createElement(tag, classes = [], attributes = {}) {
    const element = document.createElement(tag);
    
    if (typeof classes === 'string') {
        classes = [classes];
    }
    classes.forEach(cls => {
        if (cls) element.classList.add(cls);
    });
    
    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
    }
    
    return element;
}

/**
 * Плавная прокрутка к элементу
 * @param {string|HTMLElement} element - Элемент или селектор
 * @param {number} offset - Смещение
 */
function scrollToElement(element, offset = 0) {
    const el = typeof element === 'string' ? document.querySelector(element) : element;
    if (!el) return;
    
    const rect = el.getBoundingClientRect();
    const scrollTop = window.pageYOffset + rect.top - offset;
    
    window.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
    });
}





// Форматирование телефона при вводе
function formatPhoneInput(input) {
    let value = input.value.replace(/\D/g, '');
    
    if (value.length === 0) {
        input.value = '';
        return;
    }
    
    // Ограничиваем длину
    if (value.length > 11) {
        value = value.slice(0, 11);
    }
    
    // Показываем пользователю в удобном формате
    if (value.length <= 10) {
        input.value = value;
    } else {
        // Для отображения показываем без +7, но при отправке добавим
        input.value = value;
    }
}

// Добавляем обработчик на все поля ввода телефона
document.addEventListener('DOMContentLoaded', () => {
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(input => {
        input.addEventListener('input', () => formatPhoneInput(input));
    });
});




// ==================== ЭКСПОРТ ====================

// Делаем все функции глобальными
window.showToast = showToast;
window.showConfirm = showConfirm;
window.showModal = showModal;
window.formatDate = formatDate;
window.formatPhone = formatPhone;
window.formatPrice = formatPrice;
window.formatTime = formatTime;
window.validatePhone = validatePhone;
window.validateEmail = validateEmail;
window.validateName = validateName;
window.validateAddress = validateAddress;
window.generateId = generateId;
window.generatePassword = generatePassword;
window.escapeHtml = escapeHtml;
window.unescapeHtml = unescapeHtml;
window.copyToClipboard = copyToClipboard;
window.downloadFile = downloadFile;
window.exportToCSV = exportToCSV;
window.readFileAsText = readFileAsText;
window.getUrlParams = getUrlParams;
window.updateUrl = updateUrl;
window.isTouchDevice = isTouchDevice;
window.getPlatform = getPlatform;
window.isMobile = isMobile;
window.debounce = debounce;
window.throttle = throttle;
window.createElement = createElement;
window.scrollToElement = scrollToElement;

console.log('🛠️ Утилиты загружены');
