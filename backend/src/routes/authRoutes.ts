import { Router } from 'express';
import { login, forgotPassword, resetPassword } from '../controllers/authController';

const router = Router();

router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
