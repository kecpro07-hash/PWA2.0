// Конфигурация приложения
const CONFIG = {
    API_URL: window.location.origin,
    APP_NAME: 'У Нас Чисто',
    APP_VERSION: '1.0.0',
    
    // Telegram ID администратора (вставьте свой)
    ADMIN_ID: '764221355',  // ← ЗАМЕНИТЕ НА ВАШ TELEGRAM ID
    
    // Telegram бот для входа (если есть)
    TELEGRAM_BOT_USERNAME: '@UNCH_ORIGINAL_BOT',  // Опционально
    
    // Настройки бонусов
    BONUS_PERCENT: 10,
    BONUS_TO_RUB: 1,
    MAX_BONUS_PERCENT: 50,
    
    // Настройки времени
    MIN_PREP_TIME: 10,
    TIME_INTERVAL: 10,
    
    // Платежи
    SBP_PHONE: '8(906)801 67 38',
    SBP_BANK: 'СберБанк',
    SBP_NAME: 'Картавенко В. В.'
};

// Экспортируем
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
