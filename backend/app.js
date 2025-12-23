import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import { autoAuth } from './middleware/auth.js';
import statusRoutes from './routes/statusRoutes.js';
import releaseRoutes from './routes/releaseRoutes.js';
import conferenceRoutes from './routes/conferenceRoutes.js';
import postRoutes from './routes/postRoutes.js';
import kanbanRoutes from './routes/kanbanRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - allow credentials
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4321',
  credentials: true
}));

app.use(express.json());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  }
}));

// Auto-authenticate localhost/trusted IPs
app.use(autoAuth);

// 라우터 연결
app.use('/api/auth', authRoutes);
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
