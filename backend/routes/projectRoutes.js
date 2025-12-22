import express from 'express';
import { getProjects, getProject, addProject, updateProject, deleteProject } from '../controllers/projectController.js';

const router = express.Router();

router.get('/', getProjects);
router.get('/:id', getProject);
router.post('/', addProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router;
