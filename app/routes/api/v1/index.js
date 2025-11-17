import express from 'express';
const router = express.Router();

// const forEveryOne = require('./public');
// const forUser = require('./private');




import forEveryOne from './public.js';
import forUser from './private.js';
import forAdmin from './admin.js';

router.use(forEveryOne);
router.use(forUser);
router.use(forAdmin);

export default router;