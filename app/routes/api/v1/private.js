import express from 'express';
const router = express.Router();

import homeController from '../../../http/api/controllers/homeController.js';
import notepadController from '../../../http/api/controllers/notepadController.js';
import processController from '../../../http/api/controllers/processController.js';
import soundController from '../../../http/api/controllers/soundController.js';
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
router.post('/wordBank/move', authenticateUser.handle, notepadController.moveWordBankEntry);

//Word bank folders — پوشه‌های بانک واژه
router.get('/folders', authenticateUser.handle, notepadController.getFolders);
router.post('/folder', authenticateUser.handle, notepadController.createFolder);
router.put('/folder', authenticateUser.handle, notepadController.renameFolder);
router.delete('/folder', authenticateUser.handle, notepadController.deleteFolder);

//Syllable workshop — کارگاه هجا: a sound string in, matching words out.
router.get('/soundAlphabet', authenticateUser.handle, soundController.soundAlphabet);
router.get('/soundSearch', authenticateUser.handle, soundController.soundSearch);

//Rhymes drawn from the user's own bank/folders instead of the dictionary.
router.get('/bankRhymes', authenticateUser.handle, wordManageController.getBankRhymes);

//قافیهٔ ترکیبی — adjacent rhymes heard as one, answered by words and by pairs.
router.get('/compoundRhymes', authenticateUser.handle, wordManageController.getCompoundRhymes);

//Notes
router.get('/notes', authenticateUser.handle, notepadController.getNotes);
router.get('/note', authenticateUser.handle, notepadController.getNote);
router.post('/note', authenticateUser.handle, notepadController.saveNote);
router.delete('/note', authenticateUser.handle, notepadController.deleteNote);



// router.get('/user/history' , HomeController.history);

export default router;