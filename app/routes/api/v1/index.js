import express from 'express';
const router = express.Router();

// const forEveryOne = require('./public');
// const forUser = require('./private');



import AuthenticateAdmin from '../../../http/middleware/api/authenticateAdmin.js';
import forEveryOne from './public.js';
import forUser from './private.js';
import forAdmin from './admin.js';

router.use(forEveryOne);
router.use(forUser);
router.use(AuthenticateAdmin.handle, forAdmin);

export default router;