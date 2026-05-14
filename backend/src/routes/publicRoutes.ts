// backend/src/routes/publicRoutes.ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getTenantPublicInfo, submitPublicDemand } from '../controllers/publicController';

const router = Router();

const uploadTempDir = path.join(__dirname, '../../uploads/temp');
fs.mkdirSync(uploadTempDir, { recursive: true });

const upload = multer({
  dest: uploadTempDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,
  message: { error: 'Muitas tentativas. Tente novamente em uma hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const infoLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/tenant/:slug', infoLimiter, getTenantPublicInfo);
router.post('/demanda/:slug', submitLimiter, upload.single('foto'), submitPublicDemand);

export default router;
