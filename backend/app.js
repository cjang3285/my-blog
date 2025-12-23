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

// CORS configuration - allow multiple origins
const allowedOrigins = [
  'http://localhost:4321',
  'http://127.0.0.1:4321',
  'https://chanwook.kr',           // 프로덕션 도메인
  'https://www.chanwook.kr',       // www 포함
  process.env.FRONTEND_URL         // 환경 변수에서 추가 도메인
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Trust proxy (nginx 리버스 프록시 사용 시 필요)
app.set('trust proxy', 1);

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: 'auto',  // auto: HTTPS면 secure, HTTP면 non-secure
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax'  // CSRF 보호
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
