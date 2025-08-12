import express from 'express';
const router = express.Router();

import wordManageController from '../../../http/api/controllers/wordManageController.js';

router.get('/admin/checkToken', (req, res) => { res.status(200).json() });

router.get('/admin/getWords', wordManageController.getWords);
router.put('/admin/updateWord', wordManageController.updateWord);
router.delete('/admin/deleteWord', wordManageController.deleteWord);
router.put('/admin/updateWordStatus', wordManageController.updateWordStatus);

export default router;
