import express from 'express';
import { getKanban, moveCard, deleteCard } from '../controllers/kanbanController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getKanban);

// Protected routes (require authentication)
router.put('/move', requireAuth, moveCard);
router.delete('/card', requireAuth, deleteCard);

export default router;
