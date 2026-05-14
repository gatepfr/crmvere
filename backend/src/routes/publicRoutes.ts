// backend/src/routes/publicRoutes.ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { getTenantPublicInfo, submitPublicDemand } from '../controllers/publicController';

const router = Router();

const upload = multer({
  dest: 'uploads/temp/',
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

router.get('/tenant/:slug', getTenantPublicInfo);
router.post('/demanda/:slug', submitLimiter, upload.single('foto'), submitPublicDemand);

export default router;
