import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../data/kanban.json');

export const loadKanban = () => {
  if (!fs.existsSync(filePath)) {
    return { todo: [], inProgress: [], done: [] };
  }
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
};

export const saveKanban = (kanban) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(kanban, null, 2));
};
