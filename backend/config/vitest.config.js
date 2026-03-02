import { defineConfig } from 'vitest/config';

// 단위 테스트 전용 (DB 불필요)
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.js'],
    exclude: ['node_modules/**', 'config/**', 'tests/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'config/', 'tests/'],
    },
  },
});
