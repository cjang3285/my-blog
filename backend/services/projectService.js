import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../data/projects.json');

export const loadProjects = () => {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
};

export const saveProjects = (projects) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(projects, null, 2));
};

export const getAllProjects = () => {
  return loadProjects();
};

export const createProject = (projectData) => {
  const projects = loadProjects();
  const newProject = {
    id: new Date().getTime(), // Simple unique ID
    ...projectData,
  };
  projects.unshift(newProject); // Add to the beginning of the list
  saveProjects(projects);
  return newProject;
};

export const getProjectById = (id) => {
  const projects = loadProjects();
  return projects.find(p => p.id === parseInt(id, 10));
};

export const updateProject = (id, projectData) => {
  const projects = loadProjects();
  const projectIndex = projects.findIndex(p => p.id === parseInt(id, 10));

  if (projectIndex === -1) {
    return null; // Not found
  }

  const updatedProject = {
    ...projects[projectIndex],
    ...projectData,
  };
  projects[projectIndex] = updatedProject;
  saveProjects(projects);
  return updatedProject;
};

export const deleteProject = (id) => {
  const projects = loadProjects();
  const initialLength = projects.length;
  const updatedProjects = projects.filter(p => p.id !== parseInt(id, 10));

  if (updatedProjects.length === initialLength) {
    return null; // Not found
  }

  saveProjects(updatedProjects);
  return { id: parseInt(id, 10) }; // Return the deleted ID
};
