import { loadProjects, saveProjects } from '../services/projectService.js';

export const getProjects = (req, res) => {
  res.json(loadProjects());
};

export const addProject = (req, res) => {
  const projects = loadProjects();
  const newProject = {
    id: Date.now(),
    ...req.body
  };
  projects.push(newProject);
  saveProjects(projects);
  res.json(newProject);
};

export const deleteProject = (req, res) => {
  const id = Number(req.params.id);
  let projects = loadProjects();
  projects = projects.filter(project => project.id !== id);
  saveProjects(projects);
  res.json({ success: true });
};
