import express from 'express';
const router = express.Router();

import wordManageController from '../../../http/api/controllers/wordManageController.js';
import batchController from '../../../http/api/controllers/batchController.js';
import uploadMiddleware from '../../../http/middleware/api/uploadMiddleware.js';
import authenticateAdmin from '../../../http/middleware/api/authenticateAdmin.js';



router.get('/admin/checkToken', authenticateAdmin.handle, (req, res) => { res.status(200).json() });

// Word management routes
router.get('/admin/getWords', authenticateAdmin.handle, wordManageController.getWords);
router.post('/admin/save-batch-word', authenticateAdmin.handle, wordManageController.saveBatchWord);
    router.put('/admin/updateWord', authenticateAdmin.handle, wordManageController.updateWord);
router.delete('/admin/deleteWord', authenticateAdmin.handle, wordManageController.deleteWord);
router.put('/admin/updateWordStatus', authenticateAdmin.handle, wordManageController.updateWordStatus);

// Batch upload routes
router.post('/admin/upload-batch', 
    authenticateAdmin.handle, 
    uploadMiddleware.single('file'), 
    batchController.uploadBatch
);

router.get('/admin/batches', 
    authenticateAdmin.handle, 
    batchController.getBatches
);

router.get('/admin/batches/:batchId', 
    authenticateAdmin.handle, 
    batchController.getBatchDetails
);

router.post('/admin/batches/:batchId/process', 
    authenticateAdmin.handle, 
    batchController.processBatch
);

router.post('/admin/batches/:batchId/process-words', 
    authenticateAdmin.handle, 
    batchController.processWordBatchRecords
);

router.delete('/admin/batches/:batchId', 
    authenticateAdmin.handle, 
    batchController.deleteBatch,
);

export default router;
