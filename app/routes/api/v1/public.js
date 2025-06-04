

import express from 'express';
const router = express.Router();
import authController from '../../../http/api/controllers/authController.js';


router.post('/login', authController.login);


export default router;