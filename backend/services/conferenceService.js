import pool from '../../config/db.js';

export const getConferences = async () => {
  try {
    const result = await pool.query('SELECT * FROM conferences ORDER BY name ASC');
    return result.rows;
  } catch (error) {
    console.error('Error in getConferences service:', error);
    throw error;
  }
};

export const addConference = async (conferenceData) => {
  try {
    const { name, url } = conferenceData;
    const result = await pool.query(
      'INSERT INTO conferences (name, url) VALUES ($1, $2) RETURNING *',
      [name, url]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error in addConference service:', error);
    throw error;
  }
};

export const deleteConference = async (id) => {
  try {
    const result = await pool.query(
      'DELETE FROM conferences WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error in deleteConference service:', error);
    throw error;
  }
};
