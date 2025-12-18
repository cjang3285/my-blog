import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'conferences.json');

export const loadConferences = () => {
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath));
};

export const saveConferences = (data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};
