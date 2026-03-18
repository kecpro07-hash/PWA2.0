import os
import logging
import psycopg2
import psycopg2.extras
from datetime import datetime

logger = logging.getLogger(__name__)

def get_db_connection():
    """Создает подключение к базе данных"""
    try:
        conn = psycopg2.connect(
            os.environ.get('DATABASE_URL'),
            sslmode='require'
        )
        return conn
    except Exception as e:
        logger.error(f"❌ Ошибка подключения к БД: {e}")
        return None

def init_db():
    """Инициализация базы данных"""
    conn = get_db_connection()
    if not conn:
        logger.error("❌ Не удалось подключиться к БД для инициализации")
        return False
    
    try:
        cur = conn.cursor()
        
        # Таблица пользователей
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                name TEXT,
                phone TEXT,
                address TEXT,
                username TEXT,
                short_id TEXT UNIQUE,
                password_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Таблица сессий (для JWT)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
                token TEXT UNIQUE,
                expires_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Таблица заказов
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
        
        # Таблица отзывов
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
        
        # Таблица забаненных ID
        cur.execute("""
            CREATE TABLE IF NOT EXISTS banned_ids (
                id TEXT PRIMARY KEY
            )
        """)
        
        # Таблица забаненных пользователей
        cur.execute("""
            CREATE TABLE IF NOT EXISTS banned_users (
                user_id TEXT PRIMARY KEY
            )
        """)
        
        # Таблица бонусов
        cur.execute("""
            CREATE TABLE IF NOT EXISTS bonuses (
                user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
                balance INTEGER DEFAULT 0,
                total_earned INTEGER DEFAULT 0,
                total_spent INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Таблица истории бонусов
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
        
        conn.commit()
        logger.info("✅ База данных инициализирована")
        return True
        
    except Exception as e:
        logger.error(f"❌ Ошибка инициализации БД: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()
