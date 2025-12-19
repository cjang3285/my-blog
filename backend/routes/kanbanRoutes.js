import express from 'express';
import { getKanban, addCard, moveCard, deleteCard, updateCard } from '../controllers/kanbanController.js';

const router = express.Router();

router.get('/', getKanban);
router.post('/card', addCard);
router.put('/move', moveCard);
router.delete('/card', deleteCard);
router.put('/card', updateCard);

export default router;
