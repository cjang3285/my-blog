import pg from 'pg';
const { Pool } = pg;

// 통합 테스트용 DB 풀 (운영 DB와 분리된 test DB를 바라봄)
// 환경변수: TEST_DB_* 또는 backend/config/.env.test
const testPool = new Pool({
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5433'),
  database: process.env.TEST_DB_NAME || 'my_blog_test',
  user: process.env.TEST_DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || '',
});

export default testPool;
