import pg from 'pg';
const { Pool } = pg;

const SLOW_QUERY_THRESHOLD_MS = 1000;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'my_blog',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

pool.on('connect', (client) => {
  const schema = process.env.DB_SCHEMA || 'public';
  client.query(`SET search_path TO ${schema}`);
  console.log('[DB] Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

pool.on('remove', () => {
  console.log(`[DB] Client removed from pool (total: ${pool.totalCount}, idle: ${pool.idleCount}, waiting: ${pool.waitingCount})`);
});

// Wrap pool.query to add slow query logging
const originalQuery = pool.query.bind(pool);
pool.query = async (...args) => {
  const start = Date.now();
  try {
    const result = await originalQuery(...args);
    const duration = Date.now() - start;
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      const queryText = typeof args[0] === 'string' ? args[0] : args[0]?.text;
      console.warn(`[DB] Slow query (${duration}ms): ${queryText?.substring(0, 200)}`);
    }
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    const queryText = typeof args[0] === 'string' ? args[0] : args[0]?.text;
    console.error(`[DB] Query failed (${duration}ms): ${queryText?.substring(0, 200)} - ${error.message}`);
    throw error;
  }
};

export default pool;
