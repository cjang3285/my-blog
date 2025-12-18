import express from 'express';
import { getReleases, downloadRelease } from '../controllers/releaseController.js';

const router = express.Router();

router.get('/', getReleases);
router.get('/download/:filename', downloadRelease);

export default router;
