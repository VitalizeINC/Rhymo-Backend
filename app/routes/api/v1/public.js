

import express from 'express';
const router = express.Router();
import authController from '../../../http/api/controllers/authController.js';


router.post('/login', authController.login);

router.post('/auth/apple', authController.appleLogin);

router.post('/auth/token', authController.authToken);

export default router;