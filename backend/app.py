import os
import logging
from datetime import timedelta
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_socketio import SocketIO, emit, join_room, leave_room
from database import init_db, get_db_connection
from models import User, Order, Review, Bonus
from auth import auth_bp
from payments import payments_bp
from admin import admin_bp
from bonuses import bonuses_bp
import redis
from celery import Celery

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализация Flask
app = Flask(__name__, static_folder='../frontend', static_url_path='')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)
app.config['CORS_HEADERS'] = 'Content-Type'

# CORS для всех доменов (в продакшене ограничьте)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# JWT
jwt = JWTManager(app)

# WebSocket
socketio = SocketIO(app, cors_allowed_origins="*")

# Redis для кэша и сессий
redis_client = redis.Redis(
    host=os.environ.get('REDIS_HOST', 'localhost'),
    port=int(os.environ.get('REDIS_PORT', 6379)),
    password=os.environ.get('REDIS_PASSWORD', ''),
    decode_responses=True
)

# Celery для фоновых задач
celery = Celery(
    app.name,
    broker=os.environ.get('REDIS_URL', 'redis://localhost:6379/0'),
    backend=os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
)

# Регистрация blueprint'ов
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(payments_bp, url_prefix='/api/payments')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(bonuses_bp, url_prefix='/api/bonuses')

# Инициализация БД при запуске
with app.app_context():
    init_db()

# ================== API ЭНДПОИНТЫ ==================

@app.route('/')
def serve_index():
    """Главная страница"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/health')
def health():
    """Проверка здоровья"""
    return jsonify({'status': 'ok', 'time': datetime.now().isoformat()})

# ================== ПОЛЬЗОВАТЕЛИ ==================

@app.route('/api/user/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Получить данные текущего пользователя"""
    user_id = get_jwt_identity()
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT user_id, name, phone, address, username, short_id, created_at
            FROM users WHERE user_id = %s
        """, (user_id,))
        user = cur.fetchone()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Получаем бонусы
        cur.execute("SELECT balance FROM bonuses WHERE user_id = %s", (user_id,))
        bonus = cur.fetchone()
        
        return jsonify({
            'user_id': user[0],
            'name': user[1],
            'phone': user[2],
            'address': user[3],
            'username': user[4],
            'short_id': user[5],
            'created_at': user[6].isoformat() if user[6] else None,
            'bonus_balance': bonus[0] if bonus else 0
        })
    except Exception as e:
        logger.error(f"Error getting user: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/user/update', methods=['PUT'])
@jwt_required()
def update_user():
    """Обновить данные пользователя"""
    user_id = get_jwt_identity()
    data = request.json
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE users 
            SET name = COALESCE(%s, name),
                phone = COALESCE(%s, phone),
                address = COALESCE(%s, address)
            WHERE user_id = %s
            RETURNING user_id, name, phone, address, short_id
        """, (data.get('name'), data.get('phone'), data.get('address'), user_id))
        
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
        logger.error(f"Error updating user: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ================== ЗАКАЗЫ ==================

@app.route('/api/orders', methods=['GET'])
@jwt_required()
def get_orders():
    """Получить заказы пользователя"""
    user_id = get_jwt_identity()
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
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
        logger.error(f"Error getting orders: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/orders/create', methods=['POST'])
@jwt_required()
def create_order():
    """Создать новый заказ"""
    user_id = get_jwt_identity()
    data = request.json
    
    required = ['bags', 'exact_time', 'address']
    if not all(k in data for k in required):
        return jsonify({'error': 'Missing required fields'}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cur = conn.cursor()
        
        # Получаем данные пользователя
        cur.execute("SELECT name, phone, username, short_id FROM users WHERE user_id = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        name, phone, username, short_id = user
        
        # Генерируем номер заказа
        import random, string
        order_number = ''.join(random.choices(string.ascii_uppercase, k=3)) + \
                      ''.join(random.choices(string.digits, k=5))
        
        # Рассчитываем сумму
        bags = int(data['bags'])
        amount = 100 + (bags - 1) * 25 if bags > 0 else 0
        
        # Обработка бонусов
        bonus_used = int(data.get('bonus_used', 0))
        bonus_discount = 0
        final_amount = amount
        
        if bonus_used > 0:
            # Проверяем баланс
            cur.execute("SELECT balance FROM bonuses WHERE user_id = %s", (user_id,))
            bonus_row = cur.fetchone()
            current_bonus = bonus_row[0] if bonus_row else 0
            
            if current_bonus >= bonus_used:
                # Рассчитываем скидку
                BONUS_TO_RUB = 1
                MAX_BONUS_PERCENT = 50
                
                discount_rub = bonus_used // BONUS_TO_RUB
                max_discount = amount * MAX_BONUS_PERCENT // 100
                bonus_discount = min(discount_rub, max_discount)
                final_amount = amount - bonus_discount
                
                # Списание бонусов будет после подтверждения заказа
            else:
                bonus_used = 0
        
        # Создаем заказ
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
        
        # Отправляем уведомление админу через WebSocket
        socketio.emit('new_order', {
            'number': order_number,
            'user_name': name,
            'amount': amount,
            'final_amount': final_amount
        }, room='admin')
        
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
        logger.error(f"Error creating order: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ================== ОТЗЫВЫ ==================

@app.route('/api/reviews', methods=['GET'])
def get_reviews():
    """Получить отзывы (публичный эндпоинт)"""
    limit = request.args.get('limit', 50, type=int)
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT r.order_number, r.rating, r.text, r.date, r.short_id
            FROM reviews r
            ORDER BY r.timestamp DESC
            LIMIT %s
        """, (limit,))
        
        reviews = []
        for row in cur.fetchall():
            reviews.append({
                'order_number': row[0],
                'rating': row[1],
                'text': row[2] or '',
                'date': row[3],
                'short_id': row[4]
            })
        
        # Статистика
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
        logger.error(f"Error getting reviews: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/reviews/add', methods=['POST'])
@jwt_required()
def add_review():
    """Добавить отзыв"""
    user_id = get_jwt_identity()
    data = request.json
    
    if 'order_number' not in data or 'rating' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cur = conn.cursor()
        
        # Получаем short_id пользователя
        cur.execute("SELECT short_id FROM users WHERE user_id = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        short_id = user[0]
        
        # Добавляем отзыв
        cur.execute("""
            INSERT INTO reviews (user_id, short_id, order_number, rating, text, date, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            user_id, short_id, data['order_number'], data['rating'],
            data.get('text', ''), 
            datetime.now().strftime('%d.%m.%Y %H:%M'),
            datetime.now().timestamp()
        ))
        
        # Отмечаем заказ как с отзывом
        cur.execute("""
            UPDATE orders SET reviewed = TRUE 
            WHERE number = %s AND user_id = %s
        """, (data['order_number'], user_id))
        
        conn.commit()
        
        # Обновляем JSON для GitHub (асинхронно)
        from tasks import update_github_reviews
        update_github_reviews.delay()
        
        return jsonify({'success': True, 'id': cur.fetchone()[0]})
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error adding review: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ================== БОНУСЫ ==================

@app.route('/api/bonus/balance', methods=['GET'])
@jwt_required()
def get_bonus_balance():
    """Получить баланс бонусов"""
    user_id = get_jwt_identity()
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("SELECT balance FROM bonuses WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        
        balance = row[0] if row else 0
        
        # История операций
        cur.execute("""
            SELECT amount, type, description, created_at
            FROM bonus_history
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 10
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
        logger.error(f"Error getting bonus balance: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ================== АДМИНСКИЕ ЭНДПОИНТЫ ==================

@app.route('/api/admin/orders', methods=['GET'])
@jwt_required()
def admin_get_orders():
    """Получить все заказы (только для админа)"""
    # Проверка прав админа
    if not is_admin(get_jwt_identity()):
        return jsonify({'error': 'Access denied'}), 403
    
    status = request.args.get('status')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cur = conn.cursor()
        
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
        logger.error(f"Error getting admin orders: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/admin/order/<order_number>/update', methods=['PUT'])
@jwt_required()
def admin_update_order(order_number):
    """Обновить статус заказа (только для админа)"""
    if not is_admin(get_jwt_identity()):
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.json
    status = data.get('status')
    payment = data.get('payment')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database connection failed'}), 500
    
    try:
        cur = conn.cursor()
        
        if status:
            cur.execute("""
                UPDATE orders SET status = %s 
                WHERE number = %s
                RETURNING number, status, user_id
            """, (status, order_number))
            
            updated = cur.fetchone()
            if updated and status == 'выполнен':
                # Начисляем бонусы
                from tasks import add_order_bonus
                add_order_bonus.delay(order_number)
                
                # Уведомление через WebSocket
                socketio.emit('order_status_changed', {
                    'number': order_number,
                    'status': status
                })
        
        if payment:
            cur.execute("""
                UPDATE orders SET payment = %s 
                WHERE number = %s
            """, (payment, order_number))
        
        conn.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        conn.rollback()
        logger.error(f"Error updating order: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# ================== WEBSOCKET ==================

@socketio.on('connect')
def handle_connect():
    """Обработка подключения к WebSocket"""
    logger.info(f"Client connected: {request.sid}")

@socketio.on('join_admin')
def handle_join_admin():
    """Админ подключается к админской комнате"""
    # Проверка токена (можно через query params)
    join_room('admin')
    emit('joined_admin', {'status': 'ok'})

@socketio.on('disconnect')
def handle_disconnect():
    """Обработка отключения"""
    logger.info(f"Client disconnected: {request.sid}")

# ================== ЗАПУСК ==================

def is_admin(user_id):
    """Проверка, является ли пользователь админом"""
    admin_id = os.environ.get('ADMIN_ID')
    return str(user_id) == str(admin_id)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    socketio.run(app, host='0.0.0.0', port=port, debug=debug)
