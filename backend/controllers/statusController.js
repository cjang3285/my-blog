import { fetchSystemStatus } from '../services/systemService.js';

export const getStatus = async (req, res) => {
  const data = await fetchSystemStatus();
  res.json(data);
};
