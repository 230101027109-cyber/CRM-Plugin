import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify', authenticate, authController.getProfile);
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);

export default router;
