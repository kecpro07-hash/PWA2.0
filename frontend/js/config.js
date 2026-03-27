// ==================== КОНФИГУРАЦИЯ ПРИЛОЖЕНИЯ ====================

window.CONFIG = {
    API_URL: window.location.origin,
    APP_NAME: 'У Нас Чисто',
    APP_VERSION: '1.0.0',
    
    //ID администратора (для админ-панели)
    ADMIN_ID: '570090',
    
    // Настройки бонусов
    BONUS_PERCENT: 10,
    BONUS_TO_RUB: 1,
    MAX_BONUS_PERCENT: 50,

    // Настройки телефона
    PHONE_PREFIX: '+7',
    PHONE_LENGTH: 11,

    // Настройки времени
    MIN_PREP_TIME: 10,
    TIME_INTERVAL: 10,
    
    // Платежи
    SBP_PHONE: '8(906)801 67 38',
    SBP_BANK: 'СберБанк',
    SBP_NAME: 'Картавенко В. В.'
};

console.log('⚙️ Конфигурация загружена');
