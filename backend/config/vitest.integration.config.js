import { defineConfig } from 'vitest/config';

// 통합 테스트 전용 (test DB 연결 필요)
// 실행 전 TEST_DB_* 환경변수 또는 backend/config/.env.test 설정 필요
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.js'],
    globalSetup: ['./tests/setup/global-setup.js'],
    globalTeardown: ['./tests/setup/global-teardown.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'config/', 'tests/helpers/', 'tests/setup/'],
    },
  },
});
