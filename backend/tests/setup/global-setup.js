import { takeSnapshot } from '../helpers/db-snapshot.js';

export default async function globalSetup() {
  if (!process.env.TEST_DB_HOST) {
    console.warn('[test] TEST_DB_HOST not set — DB snapshot skipped');
    return;
  }
  takeSnapshot();
}
