import express from 'express';
const router = express.Router();

// const forEveryOne = require('./public');
// const forUser = require('./private');



import AuthenticateApi from '../../../http/middleware/api/authenticateApi.js';
import forEveryOne from './public.js';
import forUser from './private.js';


router.use(forEveryOne);
// router.use(AuthenticateApi.handle, forUser);
router.use(forUser);

export default router;