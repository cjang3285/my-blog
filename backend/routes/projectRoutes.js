import express from 'express';
import { getProjects, addProject, deleteProject } from '../controllers/projectController.js';

const router = express.Router();

router.get('/', getProjects);
router.post('/', addProject);
router.delete('/:id', deleteProject);

export default router;
