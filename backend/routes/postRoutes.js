import express from 'express';
import { getPosts, getFeatured, getPost, addPost, updatePost, deletePost } from '../controllers/postController.js';

const router = express.Router();

router.get('/', getPosts);
router.get('/featured', getFeatured);
router.get('/:slug', getPost);
router.post('/', addPost);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);

export default router;
