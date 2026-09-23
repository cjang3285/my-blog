import express from 'express';
import { getPosts, getTags, getFeatured, getPost, addPost, updatePost, deletePost } from '../controllers/postController.js';
import { requireAuth, requireAuthOrPostApiToken } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getPosts);
router.get('/tags', getTags);
router.get('/featured', getFeatured);
router.get('/:slug', getPost);

// Protected routes (require authentication)
router.post('/', requireAuthOrPostApiToken, addPost);
router.put('/:id', requireAuth, updatePost);
router.delete('/:id', requireAuth, deletePost);

export default router;
