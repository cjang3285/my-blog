import { loadPosts, savePosts, getPostBySlug, getFeaturedPosts } from '../services/postService.js';

export const getPosts = (req, res) => {
  res.json(loadPosts());
};

export const getFeatured = (req, res) => {
  res.json(getFeaturedPosts());
};

export const getPost = (req, res) => {
  const post = getPostBySlug(req.params.slug);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  res.json(post);
};

export const addPost = (req, res) => {
  const posts = loadPosts();
  const newPost = {
    id: Date.now(),
    slug: req.body.title.toLowerCase().replace(/\s+/g, '-'),
    featured: false,
    date: new Date().toISOString().split('T')[0],
    ...req.body
  };
  posts.unshift(newPost);
  savePosts(posts);
  res.json(newPost);
};

export const deletePost = (req, res) => {
  const id = Number(req.params.id);
  let posts = loadPosts();
  posts = posts.filter(post => post.id !== id);
  savePosts(posts);
  res.json({ success: true });
};
