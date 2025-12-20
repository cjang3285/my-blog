// controllers/healthController.js
export const getHealthStatus = (req, res) => {
  res.json({
    status: 'ok',
    message: 'API server running',
    timestamp: new Date().toISOString()
  });
};
