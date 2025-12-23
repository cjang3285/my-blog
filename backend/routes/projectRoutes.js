import express from 'express';
import { getProjects, getProject, addProject, updateProject, deleteProject } from '../controllers/projectController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getProjects);
router.get('/:id', getProject);

// Protected routes (require authentication)
router.post('/', requireAuth, addProject);
router.put('/:id', requireAuth, updateProject);
router.delete('/:id', requireAuth, deleteProject);

export default router;
