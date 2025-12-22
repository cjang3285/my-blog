import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import statusRoutes from './routes/statusRoutes.js';
import releaseRoutes from './routes/releaseRoutes.js';
import conferenceRoutes from './routes/conferenceRoutes.js';
import postRoutes from './routes/postRoutes.js';
import kanbanRoutes from './routes/kanbanRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import healthRoutes from './routes/healthRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 라우터 연결
app.use('/api/status', statusRoutes);
app.use('/api/releases', releaseRoutes);
app.use('/api/conferences', conferenceRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/kanban', kanbanRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', healthRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
