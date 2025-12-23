import express from 'express';
import { getKanban, moveCard, deleteCard } from '../controllers/kanbanController.js';

const router = express.Router();

router.get('/', getKanban);
router.put('/move', moveCard);
router.delete('/card', deleteCard);

export default router;
