import {
  getAllProjects,
  createProject,
  updateProject as updateProjectService,
  deleteProject as deleteProjectService,
  getProjectById,
} from '../services/projectService.js';

// GET /api/projects - Get all projects
export const getProjects = (req, res) => {
  try {
    const projects = getAllProjects();
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

// POST /api/projects - Create new project
export const addProject = (req, res) => {
  try {
    const { title, description, stack, github_url } = req.body;

    if (!title || !description || !stack || !github_url) {
      return res.status(400).json({ error: 'Title, description, stack, and github_url are required' });
    }

    const newProject = createProject({ title, description, stack, github_url });
    res.status(201).json(newProject);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

// PUT /api/projects/:id - Update project
export const updateProject = (req, res) => {
  try {
    const { id } = req.params;
    const existingProject = getProjectById(id);

    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updatedProject = updateProjectService(id, req.body);
    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
};

// DELETE /api/projects/:id - Delete project
export const deleteProject = (req, res) => {
  try {
    const { id } = req.params;
    const deletedProject = deleteProjectService(id);

    if (!deletedProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true, deletedProject });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};
