import express from 'express';
import statusRoutes from './routes/statusRoutes.js';
import releaseRoutes from './routes/releaseRoutes.js';
import conferenceRoutes from './routes/conferenceRoutes.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// 라우터 연결
app.use('/api/status', statusRoutes);
app.use('/api/releases', releaseRoutes);
app.use('/api/conferences', conferenceRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
