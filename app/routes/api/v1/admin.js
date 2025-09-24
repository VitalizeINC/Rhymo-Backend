import express from 'express';
const router = express.Router();

import wordManageController from '../../../http/api/controllers/wordManageController.js';
import batchController from '../../../http/api/controllers/batchController.js';
import uploadMiddleware from '../../../http/middleware/api/uploadMiddleware.js';
import authenticateAdmin from '../../../http/middleware/api/authenticateAdmin.js';

router.get('/admin/checkToken', (req, res) => { res.status(200).json() });

// Word management routes
router.get('/admin/getWords', wordManageController.getWords);
router.put('/admin/updateWord', wordManageController.updateWord);
router.delete('/admin/deleteWord', wordManageController.deleteWord);
router.put('/admin/updateWordStatus', wordManageController.updateWordStatus);

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
    batchController.deleteBatch
);

export default router;
