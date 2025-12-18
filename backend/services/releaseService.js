import fs from 'fs';
import path from 'path';

const releaseDir = path.join(process.cwd(), 'releases');

export const listReleases = () => {
  return fs.readdirSync(releaseDir);
};

export const getReleaseFilePath = (filename) => {
  return path.join(releaseDir, filename);
};
