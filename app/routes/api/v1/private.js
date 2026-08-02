import express from 'express';
const router = express.Router();

import homeController from '../../../http/api/controllers/homeController.js';
import notepadController from '../../../http/api/controllers/notepadController.js';
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

//Notepad v2 — additive only, no rhyme-core logic lives behind these routes.
router.get('/resolveWord', authenticateUser.handle, notepadController.resolveWord);
router.get('/wordAnalysis', authenticateUser.handle, notepadController.wordAnalysis);

//Word bank
router.get('/wordBank', authenticateUser.handle, notepadController.getWordBank);
router.post('/wordBank', authenticateUser.handle, notepadController.addToWordBank);
router.delete('/wordBank', authenticateUser.handle, notepadController.removeFromWordBank);

//Notes
router.get('/notes', authenticateUser.handle, notepadController.getNotes);
router.get('/note', authenticateUser.handle, notepadController.getNote);
router.post('/note', authenticateUser.handle, notepadController.saveNote);
router.delete('/note', authenticateUser.handle, notepadController.deleteNote);



// router.get('/user/history' , HomeController.history);

export default router;