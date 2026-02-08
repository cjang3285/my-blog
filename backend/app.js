import dotenv from 'dotenv';
dotenv.config({ path: './config/.env' });
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import { autoAuth } from './middleware/auth.js';
import statusRoutes from './routes/statusRoutes.js';
import releaseRoutes from './routes/releaseRoutes.js';
import postRoutes from './routes/postRoutes.js';
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
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Trust proxy (nginx 리버스 프록시 사용 시 필요)
app.set('trust proxy', 1);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const { method, originalUrl } = req;
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const level = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(`[${level}] ${method} ${originalUrl} ${statusCode} ${duration}ms - ${ip}`);
  });

  next();
});

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
app.use('/api/posts', postRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', healthRoutes);

// Global error handling middleware
app.use((err, req, res, next) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  console.error(`[ERROR] Unhandled error on ${req.method} ${req.originalUrl} - ${ip}:`, err.message);
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Process-level error handlers
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});

process.on('SIGTERM', () => {
  console.log('[PROCESS] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[PROCESS] SIGINT received, shutting down gracefully...');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`[PROCESS] Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
