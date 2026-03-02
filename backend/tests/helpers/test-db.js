import pg from 'pg';
const { Pool } = pg;

// 통합 테스트용 DB 풀 (운영 DB와 분리된 test DB를 바라봄)
// 환경변수: TEST_DB_* 또는 backend/config/.env.test
const DEFAULT_TEST_DB_PORT = 5433;
const rawTestDbPort = process.env.TEST_DB_PORT;
const parsedTestDbPort = parseInt(
  rawTestDbPort != null ? rawTestDbPort : String(DEFAULT_TEST_DB_PORT),
  10,
);
const testDbPort = Number.isNaN(parsedTestDbPort)
  ? DEFAULT_TEST_DB_PORT
  : parsedTestDbPort;

const testPool = new Pool({
  host: process.env.TEST_DB_HOST || 'localhost',
  port: testDbPort,
  database: process.env.TEST_DB_NAME || 'my_blog_test',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || '',
});

export default testPool;
