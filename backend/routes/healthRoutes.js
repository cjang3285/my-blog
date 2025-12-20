// routes/healthRoutes.js
import express from 'express';
import { getHealthStatus } from '../controllers/healthController.js';

const router = express.Router();

// 헬스체크 엔드포인트
router.get('/', getHealthStatus);

export default router;
