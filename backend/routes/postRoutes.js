import express from 'express';
import { getPosts, getFeatured, getPost, addPost, deletePost } from '../controllers/postController.js';

const router = express.Router();

router.get('/', getPosts);
router.get('/featured', getFeatured);
router.get('/:slug', getPost);
router.post('/', addPost);
router.delete('/:id', deletePost);

export default router;
