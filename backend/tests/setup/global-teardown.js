import { restoreSnapshot } from '../helpers/db-snapshot.js';

export default async function globalTeardown() {
  if (!process.env.TEST_DB_HOST) {
    return;
  }
  restoreSnapshot();
}
