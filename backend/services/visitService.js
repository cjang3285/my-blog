import pool from '../config/db.js';

// Record a single page visit
export const recordVisit = async ({ path, method, ip, userAgent, referrer }) => {
  try {
    const result = await pool.query(
      `INSERT INTO visits (path, method, ip, user_agent, referrer)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [path, method || 'GET', ip || null, userAgent || null, referrer || null]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error in recordVisit service:', error);
    throw error;
  }
};

// Get most recent visits
export const getRecentVisits = async (limit) => {
  try {
    const result = await pool.query(
      'SELECT * FROM visits ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Error in getRecentVisits service:', error);
    throw error;
  }
};

// Get aggregate stats: totals, unique IPs, top paths (last 7 days)
export const getVisitStats = async () => {
  try {
    const [totalResult, todayResult, uniqueIpResult, topPathsResult] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM visits'),
      pool.query(
        "SELECT COUNT(*) FROM visits WHERE created_at >= NOW() - INTERVAL '1 day'"
      ),
      pool.query(
        "SELECT COUNT(DISTINCT ip) FROM visits WHERE created_at >= NOW() - INTERVAL '7 days'"
      ),
      pool.query(
        `SELECT path, COUNT(*) AS count
         FROM visits
         WHERE created_at >= NOW() - INTERVAL '7 days'
         GROUP BY path
         ORDER BY count DESC
         LIMIT 10`
      ),
    ]);

    return {
      total: parseInt(totalResult.rows[0].count, 10),
      last24h: parseInt(todayResult.rows[0].count, 10),
      uniqueIpsLast7d: parseInt(uniqueIpResult.rows[0].count, 10),
      topPathsLast7d: topPathsResult.rows,
    };
  } catch (error) {
    console.error('Error in getVisitStats service:', error);
    throw error;
  }
};
