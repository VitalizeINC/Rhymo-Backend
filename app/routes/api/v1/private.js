import express from 'express';
const router = express.Router();

import homeController from '../../../http/api/controllers/homeController.js';
import processController from '../../../http/api/controllers/processController.js';
import wordManageController from '../../../http/api/controllers/wordManageController.js';

router.get('/user', homeController.user);
router.get('/checkToken', (req, res) => { res.status(200).json() });
//Word
router.get('/getWord', wordManageController.getWord);
router.get('/suggestWord', wordManageController.suggestWord);
router.delete('/removeWord', wordManageController.removeWord);
router.post('/saveWords', wordManageController.saveWords);
//Proccess
router.get('/getRhymes', wordManageController.getRhymes);
router.get('/getPartsNumber', wordManageController.getPartsNumber);
router.post('/getWordDetails', processController.getWordDetails);



// router.get('/user/history' , HomeController.history);

export default router;