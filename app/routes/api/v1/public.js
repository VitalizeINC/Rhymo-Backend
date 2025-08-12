

import express from 'express';
const router = express.Router();
import authController from '../../../http/api/controllers/authController.js';


router.post('/login', authController.login);

router.post('/register', authController.register);

router.post('/forgot-password', authController.forgotPassword);

router.post('/reset-password', authController.resetPassword);

router.post('/auth/apple', authController.appleLogin);

router.post('/auth/google', authController.googleLogin);

router.post('/auth/token', authController.authToken);

export default router;