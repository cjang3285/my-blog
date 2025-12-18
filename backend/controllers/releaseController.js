import { listReleases, getReleaseFilePath } from '../services/releaseService.js';

export const getReleases = (req, res) => {
  const files = listReleases();
  res.json(files);
};

export const downloadRelease = (req, res) => {
  const filename = req.params.filename;
  const filePath = getReleaseFilePath(filename);
  res.download(filePath);
};
