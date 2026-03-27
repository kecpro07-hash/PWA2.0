import os
import logging
import secrets
import hashlib
import json
import random
import string
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity
)
from flask_socketio import SocketIO, emit, join_room
import psycopg2
import psycopg2.extras

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализация Flask
app = Flask(__name__, static_folder='../frontend', static_url_path='')

# Конфигурация
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', secrets.token_hex(32))
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=90)

# CORS
CORS(app, resources={
    r"/api/*": {
        "origins": os.environ.get('CORS_ORIGINS', '*').split(',')
    }
})

# JWT
jwt = JWTManager(app)

# WebSocket
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='gevent')

# ================== НОРМАЛИЗАЦИЯ ТЕЛЕФОНОВ ==================

def normalize_phone(phone):
    """
    Приводит телефон к единому формату: +7XXXXXXXXXX (12 символов)
    Поддерживает форматы: 8XXXXXXXXXX, +7XXXXXXXXXX, 7XXXXXXXXXX, XXXXXXXXXX
    """
    if not phone:
        return None
    
    # Удаляем все нецифровые символы
    digits = ''.join(filter(str.isdigit, phone))
    
    # Если меньше 10 цифр - некорректный номер
    if len(digits) < 10:
        return None
    
    # Если 10 цифр (например, 9261234567) -> +79261234567
    if len(digits) == 10:
        return f"+7{digits}"
    
    # Если 11 цифр
    if len(digits) == 11:
        # Если начинается с 8 (8XXXXXXXXXX) -> +7XXXXXXXXXX
        if digits.startswith('8'):
            return f"+7{digits[1:]}"
        # Если начинается с 7 (7XXXXXXXXXX) -> +7XXXXXXXXXX
        if digits.startswith('7'):
            return f"+7{digits}"
    
    # Если 12 цифр и начинается с 7
    if len(digits) == 12 and digits.startswith('7'):
        return f"+{digits}"
    
    # Если уже есть +
    if phone.startswith('+'):
        return phone
    
    return f"+7{digits[-10:]}"  # Если ничего не подошло, берем последние 10 цифр
# ================== БАЗА ДАННЫХ ==================

def get_db():
    """Получить соединение с БД"""
    try:
        conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
        return conn
    except Exception as e:
        logger.error(f"Ошибка подключения к БД: {e}")
        return None

def init_db():
    """Инициализация таблиц"""
    conn = get_db()
    if not conn:
        return False
    
    try:
        cur = conn.cursor()
        
        # Пользователи (с паролем)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                name TEXT,
                phone TEXT UNIQUE,
                address TEXT,
                username TEXT,
                short_id TEXT UNIQUE,
                password_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                last_login TIMESTAMP
            )
        """)
        
        # Заказы
        cur.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                number TEXT PRIMARY KEY,
                user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
                name TEXT,
                phone TEXT,
                address TEXT,
                username TEXT,
                short_id TEXT,
                exact_time TEXT,
                bags INTEGER,
                amount INTEGER,
                final_amount INTEGER DEFAULT 0,
                bonus_used INTEGER DEFAULT 0,
                bonus_discount INTEGER DEFAULT 0,
                status TEXT,
                payment TEXT,
                reviewed BOOLEAN DEFAULT FALSE,
                courier_id TEXT,
                created_at TIMESTAMP
            )
        """)
        
        # Отзывы
        cur.execute("""
            CREATE TABLE IF NOT EXISTS reviews (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
                short_id TEXT,
                order_number TEXT REFERENCES orders(number) ON DELETE CASCADE,
                rating INTEGER,
                text TEXT,
                date TEXT,
                timestamp BIGINT
            )
        """)
        
        # Бонусы
        cur.execute("""
            CREATE TABLE IF NOT EXISTS bonuses (
                user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
                balance INTEGER DEFAULT 0,
                total_earned INTEGER DEFAULT 0,
                total_spent INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # История бонусов
        cur.execute("""
            CREATE TABLE IF NOT EXISTS bonus_history (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
                order_number TEXT REFERENCES orders(number) ON DELETE SET NULL,
                amount INTEGER NOT NULL,
                type TEXT CHECK (type IN ('earn', 'spend')),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Забаненные
        cur.execute("""
            CREATE TABLE IF NOT EXISTS banned_ids (
                id TEXT PRIMARY KEY
            )
        """)
        
        cur.execute("""
            CREATE TABLE IF NOT EXISTS banned_users (
                user_id TEXT PRIMARY KEY
            )
        """)
        
        # Восстановление паролей
        cur.execute("""
            CREATE TABLE IF NOT EXISTS password_resets (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                code TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        logger.info("✅ База данных инициализирована")
        return True
        
    except Exception as e:
        logger.error(f"Ошибка инициализации БД: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

# Инициализация при запуске
init_db()

# ================== ФУНКЦИИ ДЛЯ ПАРОЛЕЙ ==================

def hash_password(password):
    """Хеширует пароль с солью"""
    import hashlib
    import secrets
    salt = secrets.token_hex(16)
    hash_obj = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}${hash_obj}"


def verify_password(password, stored_hash):
    """Проверяет пароль"""
    try:
        if not stored_hash:
            return False
        salt, hash_value = stored_hash.split('$')
        computed_hash = hashlib.sha256((password + salt).encode()).hexdigest()
        return computed_hash == hash_value
    except:
        return False

# ================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==================

def generate_order_number():
    """Генерация номера заказа"""
    letters = ''.join(random.choices(string.ascii_uppercase, k=3))
    numbers = ''.join(random.choices(string.digits, k=5))
    return f"{letters}{numbers}"

def generate_short_id():
    """Генерация короткого ID"""
    while True:
        short_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        conn = get_db()
        if conn:
            cur = conn.cursor()
            cur.execute("SELECT user_id FROM users WHERE short_id = %s", (short_id,))
            if not cur.fetchone():
                conn.close()
                return short_id
            conn.close()

def calculate_price(bags):
    """Расчет стоимости"""
    return 100 + (bags - 1) * 25 if bags > 0 else 0

# ================== API ЭНДПОИНТЫ ==================

@app.route('/')
def serve_index():
    """Главная страница"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/health')
def health():
    """Проверка здоровья"""
    return jsonify({
        'status': 'ok',
        'time': datetime.now().isoformat(),
        'database': 'connected' if get_db() else 'error'
    })

# ================== АВТОРИЗАЦИЯ ==================

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Регистрация пользователя"""
    data = request.json
    
    if not data.get('name') or not data.get('phone') or not data.get('password'):
        return jsonify({'error': 'Имя, телефон и пароль обязательны'}), 400
    
    if len(data['password']) < 4:
        return jsonify({'error': 'Пароль должен быть не менее 4 символов'}), 400
    
    # Нормализуем телефон
    phone_raw = data['phone']
    digits = ''.join(filter(str.isdigit, phone_raw))
    
    if len(digits) == 10:
        normalized_phone = '+7' + digits
    elif len(digits) == 11 and digits.startswith('7'):
        normalized_phone = '+' + digits
    elif len(digits) == 11 and digits.startswith('8'):
        normalized_phone = '+7' + digits[1:]
    else:
        normalized_phone = phone_raw
    
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor()
        
        # Проверяем существование
        cur.execute("SELECT user_id FROM users WHERE phone = %s", (normalized_phone,))
        if cur.fetchone():
            return jsonify({'error': 'Пользователь с таким телефоном уже существует'}), 400
        
        # Генерируем ID
        import random
        import string
        user_id = str(random.randint(100000, 999999))
        short_id = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        
        # Хешируем пароль
        import hashlib
        import secrets
        salt = secrets.token_hex(16)
        password_hash = f"{salt}${hashlib.sha256((data['password'] + salt).encode()).hexdigest()}"
        
        # Создаем пользователя
        cur.execute("""
            INSERT INTO users (user_id, name, phone, address, username, short_id, password_hash, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """, (user_id, data['name'], normalized_phone, data.get('address', ''), 
              data.get('username', ''), short_id, password_hash))
        
        # Создаем бонусы
        cur.execute("""
            INSERT INTO bonuses (user_id, balance, total_earned, total_spent)
            VALUES (%s, 0, 0, 0)
        """, (user_id,))
        
        conn.commit()
        
        # Создаем токен
        from flask_jwt_extended import create_access_token
        access_token = create_access_token(identity=user_id)
        
        return jsonify({
            'access_token': access_token,
            'user': {
                'user_id': user_id,
                'name': data['name'],
                'phone': normalized_phone,
                'address': data.get('address', ''),
                'short_id': short_id,
                'bonus_balance': 0
            }
        })
        
    except Exception as e:
        conn.rollback()
        print(f"Ошибка: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    phone = data.get('phone')
    password = data.get('password')
    
    if not phone or not password:
        return jsonify({'error': 'Телефон и пароль обязательны'}), 400
    
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor()
        # Ищем пользователя по телефону
        cur.execute("SELECT user_id, name, phone, address, username, short_id, password_hash FROM users WHERE phone = %s", (phone,))
        user = cur.fetchone()
        
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        # Проверка пароля
        if not verify_password(password, user[6]):
            return jsonify({'error': 'Неверный пароль'}), 401
        
        # Создаём JWT токен
        access_token = create_access_token(identity=user[0])
        
        return jsonify({
            'access_token': access_token,
            'user': {
                'user_id': user[0],
                'name': user[1],
                'phone': user[2],
                'address': user[3],
                'username': user[4],
                'short_id': user[5],
                'bonus_balance': 0
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Обновление токена"""
    user_id = get_jwt_identity()
    access_token = create_access_token(identity=user_id)
    return jsonify({'access_token': access_token})

# ================== СМЕНА ПАРОЛЯ ==================

@app.route('/api/user/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Смена пароля"""
    user_id = get_jwt_identity()
    data = request.json
    
    if not data.get('old_password') or not data.get('new_password'):
        return jsonify({'error': 'Старый и новый пароль обязательны'}), 400
    
    if len(data['new_password']) < 4:
        return jsonify({'error': 'Новый пароль должен быть не менее 4 символов'}), 400
    
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor()
        
        cur.execute("SELECT password_hash FROM users WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        
        if not row:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        if not verify_password(data['old_password'], row[0]):
            return jsonify({'error': 'Неверный старый пароль'}), 401
        
        new_hash = hash_password(data['new_password'])
        
        cur.execute("""
            UPDATE users SET password_hash = %s, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s
        """, (new_hash, user_id))
        
        conn.commit()
        
        return jsonify({'success': True, 'message': 'Пароль успешно изменен'})
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Ошибка смены пароля: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ================== ВОССТАНОВЛЕНИЕ ПАРОЛЯ ==================

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """Запрос на восстановление пароля"""
    data = request.json
    
    if not data.get('phone'):
        return jsonify({'error': 'Телефон обязателен'}), 400
    
    normalized_phone = normalize_phone(data['phone'])
    
    if not normalized_phone:
        return jsonify({'error': 'Некорректный номер телефона'}), 400
    
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor()
        
        cur.execute("SELECT user_id, name FROM users WHERE phone = %s", (normalized_phone,))
        user = cur.fetchone()
        
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        reset_code = ''.join(random.choices('0123456789', k=6))
        
        cur.execute("""
            INSERT INTO password_resets (user_id, code, expires_at)
            VALUES (%s, %s, NOW() + INTERVAL '15 minutes')
            ON CONFLICT (user_id) DO UPDATE SET 
                code = EXCLUDED.code,
                expires_at = EXCLUDED.expires_at
        """, (user[0], reset_code))
        conn.commit()
        
        return jsonify({
            'success': True,
            'message': 'Код восстановления отправлен',
            'reset_code': reset_code
        })
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Ошибка восстановления пароля: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/auth/confirm-reset', methods=['POST'])
def confirm_reset():
    """Подтверждение восстановления пароля"""
    data = request.json
    
    if not data.get('phone') or not data.get('code') or not data.get('new_password'):
        return jsonify({'error': 'Все поля обязательны'}), 400
    
    if len(data['new_password']) < 4:
        return jsonify({'error': 'Пароль должен быть не менее 4 символов'}), 400
    
    normalized_phone = normalize_phone(data['phone'])
    
    if not normalized_phone:
        return jsonify({'error': 'Некорректный номер телефона'}), 400
    
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor()
        
        cur.execute("SELECT user_id FROM users WHERE phone = %s", (normalized_phone,))
        user = cur.fetchone()
        
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        cur.execute("""
            SELECT code FROM password_resets 
            WHERE user_id = %s AND expires_at > NOW()
        """, (user[0],))
        
        reset = cur.fetchone()
        
        if not reset or reset[0] != data['code']:
            return jsonify({'error': 'Неверный или истекший код'}), 400
        
        new_hash = hash_password(data['new_password'])
        cur.execute("""
            UPDATE users SET password_hash = %s, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s
        """, (new_hash, user[0]))
        
        cur.execute("DELETE FROM password_resets WHERE user_id = %s", (user[0],))
        
        conn.commit()
        
        return jsonify({'success': True, 'message': 'Пароль успешно изменен'})
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Ошибка подтверждения восстановления: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ================== ПОЛЬЗОВАТЕЛИ ==================

@app.route('/api/user/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Получить данные текущего пользователя"""
    user_id = get_jwt_identity()
    
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor()
        
        cur.execute("""
            SELECT u.user_id, u.name, u.phone, u.address, u.username, u.short_id, u.created_at,
                   COALESCE(b.balance, 0) as bonus_balance
            FROM users u
            LEFT JOIN bonuses b ON u.user_id = b.user_id
            WHERE u.user_id = %s
        """, (user_id,))
        
        user = cur.fetchone()
        
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        return jsonify({
            'user_id': user[0],
            'name': user[1],
            'phone': user[2],
            'address': user[3],
            'username': user[4],
            'short_id': user[5],
            'created_at': user[6].isoformat() if user[6] else None,
            'bonus_balance': user[7] or 0
        })
        
    except Exception as e:
        logger.error(f"Ошибка получения пользователя: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/user/update', methods=['PUT'])
@jwt_required()
def update_user():
    """Обновить данные пользователя"""
    user_id = get_jwt_identity()
    data = request.json
    
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor()
        
        updates = []
        values = []
        
        if 'name' in data:
            updates.append("name = %s")
            values.append(data['name'])
        
        if 'phone' in data:
            normalized_new_phone = normalize_phone(data['phone'])
            if not normalized_new_phone:
                return jsonify({'error': 'Некорректный номер телефона'}), 400
            
            cur.execute("SELECT user_id FROM users WHERE phone = %s AND user_id != %s", 
                        (normalized_new_phone, user_id))
            if cur.fetchone():
                return jsonify({'error': 'Телефон уже используется'}), 400
            
            updates.append("phone = %s")
            values.append(normalized_new_phone)
        
        if 'address' in data:
            updates.append("address = %s")
            values.append(data['address'])
        
        if not updates:
            return jsonify({'error': 'Нет данных для обновления'}), 400
        
        values.append(user_id)
        
        cur.execute(f"""
            UPDATE users 
            SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s
            RETURNING user_id, name, phone, address, short_id
        """, values)
        
        updated = cur.fetchone()
        conn.commit()
        
        return jsonify({
            'user_id': updated[0],
            'name': updated[1],
            'phone': updated[2],
            'address': updated[3],
            'short_id': updated[4]
        })
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Ошибка обновления: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ================== ЗАКАЗЫ ==================

@app.route('/api/orders', methods=['GET'])
@jwt_required()
def get_orders():
    """Получить заказы пользователя"""
    user_id = get_jwt_identity()
    
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT number, exact_time, bags, amount, final_amount, 
                   bonus_used, bonus_discount, status, payment, reviewed,
                   created_at
            FROM orders 
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 50
        """, (user_id,))
        
        orders = []
        for row in cur.fetchall():
            orders.append({
                'number': row[0],
                'exact_time': row[1],
                'bags': row[2],
                'amount': row[3],
                'final_amount': row[4],
                'bonus_used': row[5],
                'bonus_discount': row[6],
                'status': row[7],
                'payment': row[8],
                'reviewed': row[9],
                'created_at': row[10].isoformat() if row[10] else None
            })
        
        return jsonify(orders)
        
    except Exception as e:
        logger.error(f"Ошибка получения заказов: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/orders/create', methods=['POST'])
@jwt_required()
def create_order():
    """Создать заказ"""
    user_id = get_jwt_identity()
    data = request.json
    
    required = ['bags', 'exact_time', 'address']
    if not all(k in data for k in required):
        return jsonify({'error': 'Не все поля заполнены'}), 400
    
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor()
        
        cur.execute("""
            SELECT name, phone, username, short_id 
            FROM users WHERE user_id = %s
        """, (user_id,))
        
        user = cur.fetchone()
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        name, phone, username, short_id = user
        
        order_number = generate_order_number()
        
        bags = int(data['bags'])
        amount = calculate_price(bags)
        
        bonus_used = int(data.get('bonus_used', 0))
        bonus_discount = 0
        final_amount = amount
        
        if bonus_used > 0:
            cur.execute("SELECT balance FROM bonuses WHERE user_id = %s", (user_id,))
            bonus_row = cur.fetchone()
            current_bonus = bonus_row[0] if bonus_row else 0
            
            if current_bonus >= bonus_used:
                discount_rub = bonus_used
                max_discount = amount * 50 // 100
                bonus_discount = min(discount_rub, max_discount)
                final_amount = amount - bonus_discount
                
                cur.execute("""
                    UPDATE bonuses 
                    SET balance = balance - %s,
                        total_spent = total_spent + %s,
                        last_updated = CURRENT_TIMESTAMP
                    WHERE user_id = %s
                """, (bonus_used, bonus_used, user_id))
                
                cur.execute("""
                    INSERT INTO bonus_history (user_id, order_number, amount, type, description)
                    VALUES (%s, %s, %s, 'spend', %s)
                """, (user_id, order_number, bonus_used, f"Списание за заказ {order_number}"))
            else:
                bonus_used = 0
        
        cur.execute("""
            INSERT INTO orders (
                number, user_id, name, phone, address, username, short_id,
                exact_time, bags, amount, final_amount, bonus_used, bonus_discount,
                status, payment, reviewed, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING number
        """, (
            order_number, user_id, name, phone, data['address'], username, short_id,
            data['exact_time'], bags, amount, final_amount, bonus_used, bonus_discount,
            'новый', 'ожидает', False, datetime.now()
        ))
        
        conn.commit()
        
        socketio.emit('new_order', {
            'order_number': order_number,
            'name': name,
            'amount': final_amount,
            'address': data['address'],
            'time': data['exact_time']
        }, room='admin_room')
        
        return jsonify({
            'number': order_number,
            'amount': amount,
            'final_amount': final_amount,
            'bonus_used': bonus_used,
            'bonus_discount': bonus_discount,
            'exact_time': data['exact_time']
        })
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Ошибка создания заказа: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ================== ОТЗЫВЫ ==================

@app.route('/api/reviews', methods=['GET'])
def get_reviews():
    """Получить все отзывы (публично)"""
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor()
        
        cur.execute("""
            SELECT order_number, rating, text, date, short_id
            FROM reviews
            ORDER BY timestamp DESC
            LIMIT 50
        """)
        
        reviews = []
        for row in cur.fetchall():
            reviews.append({
                'order_number': row[0],
                'rating': row[1],
                'text': row[2] or '',
                'date': row[3],
                'short_id': row[4]
            })
        
        cur.execute("""
            SELECT 
                COUNT(*) as total,
                AVG(rating) as avg,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_stars
            FROM reviews
        """)
        
        stats = cur.fetchone()
        
        return jsonify({
            'reviews': reviews,
            'stats': {
                'total': stats[0],
                'average': round(stats[1], 1) if stats[1] else 0,
                'five_stars': stats[2] or 0
            },
            'last_updated': datetime.now().strftime('%d.%m.%Y %H:%M')
        })
        
    except Exception as e:
        logger.error(f"Ошибка получения отзывов: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/reviews/add', methods=['POST'])
@jwt_required()
def add_review():
    """Добавить отзыв"""
    user_id = get_jwt_identity()
    data = request.json
    
    if not data.get('order_number') or not data.get('rating'):
        return jsonify({'error': 'Не все поля заполнены'}), 400
    
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor()
        
        cur.execute("SELECT short_id FROM users WHERE user_id = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        short_id = user[0]
        
        cur.execute("""
            SELECT number FROM orders 
            WHERE number = %s AND user_id = %s
        """, (data['order_number'], user_id))
        
        if not cur.fetchone() and data['order_number'] != "GENERAL":
            return jsonify({'error': 'Заказ не найден'}), 404
        
        cur.execute("""
            INSERT INTO reviews (user_id, short_id, order_number, rating, text, date, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            user_id, short_id, data['order_number'], data['rating'],
            data.get('text', ''),
            datetime.now().strftime('%d.%m.%Y %H:%M'),
            int(datetime.now().timestamp())
        ))
        
        if data['order_number'] != "GENERAL":
            cur.execute("""
                UPDATE orders SET reviewed = TRUE 
                WHERE number = %s
            """, (data['order_number'],))
        
        conn.commit()
        
        return jsonify({'success': True, 'id': cur.fetchone()[0]})
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Ошибка добавления отзыва: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ================== БОНУСЫ ==================

@app.route('/api/bonus/balance', methods=['GET'])
@jwt_required()
def get_bonus_balance():
    """Получить баланс бонусов"""
    user_id = get_jwt_identity()
    
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor()
        
        cur.execute("SELECT balance FROM bonuses WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        balance = row[0] if row else 0
        
        cur.execute("""
            SELECT amount, type, description, created_at
            FROM bonus_history
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 20
        """, (user_id,))
        
        history = []
        for h in cur.fetchall():
            history.append({
                'amount': h[0],
                'type': h[1],
                'description': h[2],
                'created_at': h[3].isoformat() if h[3] else None
            })
        
        return jsonify({
            'balance': balance,
            'history': history
        })
        
    except Exception as e:
        logger.error(f"Ошибка получения бонусов: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ================== АДМИНКА ==================

def admin_required(f):
    """Декоратор для проверки прав админа"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_jwt_identity()
        admin_id = os.environ.get('ADMIN_ID')
        
        if str(user_id) != str(admin_id):
            return jsonify({'error': 'Доступ запрещен'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/admin/orders', methods=['GET'])
@jwt_required()
@admin_required
def admin_get_orders():
    """Получить все заказы (админ)"""
    status = request.args.get('status')
    
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        if status:
            cur.execute("""
                SELECT * FROM orders 
                WHERE status = %s 
                ORDER BY created_at DESC
            """, (status,))
        else:
            cur.execute("SELECT * FROM orders ORDER BY created_at DESC")
        
        orders = []
        for row in cur.fetchall():
            orders.append(dict(row))
        
        return jsonify(orders)
        
    except Exception as e:
        logger.error(f"Ошибка получения заказов: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/admin/order/<order_number>/status', methods=['PUT'])
@jwt_required()
@admin_required
def admin_update_order_status(order_number):
    """Обновить статус заказа"""
    data = request.json
    status = data.get('status')
    
    if not status:
        return jsonify({'error': 'Статус не указан'}), 400
    
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor()
        
        cur.execute("""
            UPDATE orders 
            SET status = %s 
            WHERE number = %s
            RETURNING number, user_id, amount
        """, (status, order_number))
        
        updated = cur.fetchone()
        
        if updated and status == 'выполнен':
            order_number, user_id, amount = updated
            bonus_amount = amount * 10 // 100
            
            if bonus_amount > 0:
                cur.execute("""
                    INSERT INTO bonuses (user_id, balance, total_earned)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE
                    SET balance = bonuses.balance + %s,
                        total_earned = bonuses.total_earned + %s,
                        last_updated = CURRENT_TIMESTAMP
                """, (user_id, bonus_amount, bonus_amount, bonus_amount, bonus_amount))
                
                cur.execute("""
                    INSERT INTO bonus_history (user_id, order_number, amount, type, description)
                    VALUES (%s, %s, %s, 'earn', %s)
                """, (user_id, order_number, bonus_amount, f"Начисление за заказ {order_number}"))
        
        conn.commit()
        
        return jsonify({'success': True})
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Ошибка обновления заказа: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/admin/users', methods=['GET'])
@jwt_required()
@admin_required
def admin_get_users():
    """Получить всех пользователей"""
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute("""
            SELECT u.*, COALESCE(b.balance, 0) as bonus_balance
            FROM users u
            LEFT JOIN bonuses b ON u.user_id = b.user_id
            ORDER BY u.created_at DESC
        """)
        
        users = []
        for row in cur.fetchall():
            users.append(dict(row))
        
        return jsonify(users)
        
    except Exception as e:
        logger.error(f"Ошибка получения пользователей: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/admin/bonus/add', methods=['POST'])
@jwt_required()
@admin_required
def admin_add_bonus():
    """Добавить бонусы пользователю"""
    data = request.json
    
    if not data.get('user_id') or not data.get('amount'):
        return jsonify({'error': 'Не все поля заполнены'}), 400
    
    conn = get_db()
    if not conn:
        return jsonify({'error': 'Ошибка базы данных'}), 500
    
    try:
        cur = conn.cursor()
        
        amount = int(data['amount'])
        
        cur.execute("""
            INSERT INTO bonuses (user_id, balance, total_earned)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE
            SET balance = bonuses.balance + %s,
                total_earned = bonuses.total_earned + %s,
                last_updated = CURRENT_TIMESTAMP
            RETURNING balance
        """, (data['user_id'], amount, amount, amount, amount))
        
        new_balance = cur.fetchone()[0]
        
        cur.execute("""
            INSERT INTO bonus_history (user_id, amount, type, description)
            VALUES (%s, %s, 'earn', %s)
        """, (data['user_id'], amount, f"Ручное начисление администратором"))
        
        conn.commit()
        
        return jsonify({
            'success': True,
            'new_balance': new_balance
        })
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Ошибка начисления бонусов: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ================== WEBSOCKET ==================

@socketio.on('connect')
def handle_connect():
    logger.info(f"🔌 WebSocket подключен: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"🔌 WebSocket отключен: {request.sid}")

@socketio.on('join_admin')
def handle_join_admin(data):
    try:
        token = data.get('token')
        if not token:
            return
        
        from flask_jwt_extended import decode_token
        decoded = decode_token(token)
        user_id = decoded['sub']
        admin_id = os.environ.get('ADMIN_ID')
        
        if str(user_id) == str(admin_id):
            join_room('admin_room')
            emit('admin_joined', {'status': 'connected'})
            logger.info(f"👑 Админ {user_id} подключен")
    except Exception as e:
        logger.error(f"Ошибка подключения админа: {e}")

# ================== ЗАПУСК ==================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
