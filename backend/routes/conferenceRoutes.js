import express from 'express';
import { getConferencesController, addConferenceController, deleteConferenceController } from '../controllers/conferenceController.js';

const router = express.Router();

router.get('/', getConferencesController);
router.post('/', addConferenceController);
router.delete('/:id', deleteConferenceController);

export default router;
