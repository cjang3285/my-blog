import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

const SNAPSHOT_PATH = join(tmpdir(), 'my-blog-test-snapshot.dump');

function pgEnv() {
  return { ...process.env, PGPASSWORD: process.env.TEST_DB_PASSWORD || '' };
}

function pgConnArgs() {
  return [
    `-h ${process.env.TEST_DB_HOST || 'localhost'}`,
    `-p ${process.env.TEST_DB_PORT || '5433'}`,
    `-U ${process.env.TEST_DB_USER || 'postgres'}`,
    `-d ${process.env.TEST_DB_NAME || 'my_blog_test'}`,
  ].join(' ');
}

/**
 * 테스트 실행 전: test DB 현재 상태를 스냅샷으로 저장
 */
export function takeSnapshot() {
  execSync(`pg_dump --format=custom ${pgConnArgs()} -f ${SNAPSHOT_PATH}`, {
    env: pgEnv(),
    stdio: 'pipe',
  });
  console.log(`[test] DB snapshot saved: ${SNAPSHOT_PATH}`);
}

/**
 * 테스트 완료 후: test DB를 스냅샷 시점으로 복원
 */
export function restoreSnapshot() {
  execSync(
    `pg_restore --clean --if-exists --no-owner ${pgConnArgs()} ${SNAPSHOT_PATH}`,
    { env: pgEnv(), stdio: 'pipe' }
  );
  console.log('[test] DB restored to pre-test state');
}
