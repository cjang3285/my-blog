import express from 'express';
import { getConferences, addConference, deleteConference } from '../controllers/conferenceController.js';

const router = express.Router();

router.get('/', getConferences);
router.post('/', addConference);
router.delete('/:id', deleteConference);

export default router;
