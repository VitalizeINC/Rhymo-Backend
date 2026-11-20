

import express from 'express';
const router = express.Router();
import authController from '../../../http/api/controllers/authController.js';
import blogController from '../../../http/api/controllers/blogController.js';


router.post('/login', authController.login);

router.post('/register', authController.register);

router.post('/forgot-password', authController.forgotPassword);

router.post('/reset-password', authController.resetPassword);

router.post('/verify-email', authController.verifyEmail);

router.post('/resend-verification', authController.resendVerificationEmail);

router.post('/auth/apple', authController.appleLogin);

router.post('/auth/google', authController.googleLogin);

router.post('/auth/token', authController.authToken);

// Blog for the apps: published posts only.
router.get('/blog', blogController.publicList);
router.get('/blog/:lang/:slug', blogController.publicShow);

export default router;