import os
import logging
import psycopg2
from psycopg2.extras import DictCursor

logger = logging.getLogger(__name__)

def get_db():
    """Получить соединение с базой данных"""
    try:
        conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
        return conn
    except Exception as e:
        logger.error(f"Ошибка подключения к БД: {e}")
        return None

def execute_query(query, params=None, fetch_one=False, fetch_all=False):
    """Выполнить запрос к БД"""
    conn = get_db()
    if not conn:
        return None
    
    try:
        cur = conn.cursor(cursor_factory=DictCursor)
        cur.execute(query, params or ())
        
        if fetch_one:
            result = cur.fetchone()
        elif fetch_all:
            result = cur.fetchall()
        else:
            result = None
        
        conn.commit()
        return result
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Ошибка выполнения запроса: {e}")
        return None
    finally:
        conn.close()
