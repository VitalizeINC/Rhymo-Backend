import express from 'express';
const router = express.Router();

import homeController from '../../../http/api/controllers/homeController.js';
import processController from '../../../http/api/controllers/processController.js';
import wordManageController from '../../../http/api/controllers/wordManageController.js';
import authenticateUser from '../../../http/middleware/api/authenticateUser.js';




router.get('/user', authenticateUser.handle, homeController.user);
//Word
router.get('/suggestWord', authenticateUser.handle, wordManageController.suggestWord);
router.delete('/removeWord', authenticateUser.handle, wordManageController.removeWord);
router.post('/saveWords', authenticateUser.handle, wordManageController.saveWords);

//Proccess
router.get('/getRhymes', wordManageController.getRhymes);
router.get('/getTraditionalRhymes', wordManageController.getTraditionalRhymes)
// router.get('/getPartsNumber', authenticateUser.handle, wordManageController.getPartsNumber);
router.post('/getWordDetails', authenticateUser.handle, processController.getWordDetails);



// router.get('/user/history' , HomeController.history);

export default router;