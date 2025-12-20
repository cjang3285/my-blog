import {
  getAllPosts,
  getFeaturedPosts,
  getPostBySlug,
  getPostById,
  createPost,
  updatePost as updatePostService,
  deletePost as deletePostService
} from '../services/postService.js';

// GET /api/posts - Get all posts
export const getPosts = async (req, res) => {
  try {
    const posts = await getAllPosts();
    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
};

// GET /api/posts/featured - Get featured posts
export const getFeatured = async (req, res) => {
  try {
    const posts = await getFeaturedPosts();
    res.json(posts);
  } catch (error) {
    console.error('Error fetching featured posts:', error);
    res.status(500).json({ error: 'Failed to fetch featured posts' });
  }
};

// GET /api/posts/:slug - Get single post by slug
export const getPost = async (req, res) => {
  try {
    const post = await getPostBySlug(req.params.slug);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
};

// POST /api/posts - Create new post
export const addPost = async (req, res) => {
  try {
    const { title, excerpt, content, tags, featured } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const newPost = await createPost({ title, excerpt, content, tags, featured });
    res.status(201).json(newPost);
  } catch (error) {
    console.error('Error creating post:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A post with this title already exists' });
    }
    res.status(500).json({ error: 'Failed to create post' });
  }
};

// PUT /api/posts/:id - Update post
export const updatePost = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const existingPost = await getPostById(id);
    if (!existingPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const { title, excerpt, content, tags, featured } = req.body;
    const updatedPost = await updatePostService(id, { title, excerpt, content, tags, featured });

    res.json(updatedPost);
  } catch (error) {
    console.error('Error updating post:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A post with this title already exists' });
    }
    res.status(500).json({ error: 'Failed to update post' });
  }
};

// DELETE /api/posts/:id - Delete post
export const deletePost = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid post ID' });
    }

    const deletedPost = await deletePostService(id);
    if (!deletedPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ success: true, deletedPost });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
};
