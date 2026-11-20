import express from 'express';
import adminUserController from '../../../http/api/controllers/adminUserController.js';
import { readRecent } from '../../../logging/logger.js';
const router = express.Router();

import wordManageController from '../../../http/api/controllers/wordManageController.js';
import batchController from '../../../http/api/controllers/batchController.js';
import uploadMiddleware from '../../../http/middleware/api/uploadMiddleware.js';
import authenticateAdmin from '../../../http/middleware/api/authenticateAdmin.js';



// Recent log entries, newest first, so a failure can be looked up without SSH.
//   /admin/logs?kind=error&limit=50        failed requests with full context
//   /admin/logs?kind=app&limit=100          every request
//   &user=<id>  &path=/api/v1/saveWords     narrow it down
router.get('/admin/logs', authenticateAdmin.handle, (req, res) => {
    const kind = req.query.kind === 'app' ? 'app' : 'error';
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    let rows = readRecent(kind, req.query.user || req.query.path ? 5000 : limit);
    if (req.query.user) rows = rows.filter((r) => r.user === req.query.user);
    if (req.query.path) rows = rows.filter((r) => r.path === req.query.path);
    res.json({ kind, count: Math.min(rows.length, limit), entries: rows.slice(0, limit) });
});
// Also says who is signed in, for the panel's top bar.
router.get('/admin/checkToken', authenticateAdmin.handle, (req, res) => { res.status(200).json({ email: req.user?.email || null }) });

// Word management routes
router.get('/admin/getWords', authenticateAdmin.handle, wordManageController.getWords);
router.post('/admin/save-batch-word', authenticateAdmin.handle, wordManageController.saveBatchWord);
router.put('/admin/word-batches/:wordBatchId', authenticateAdmin.handle, wordManageController.updateWordBatch);
router.put('/admin/updateWord', authenticateAdmin.handle, wordManageController.updateWord);
router.get('/admin/word-sources', authenticateAdmin.handle, wordManageController.getWordSources);

// Users: list, one user, the words they added, change role and word levels.
router.get('/admin/users', authenticateAdmin.handle, adminUserController.list);
router.get('/admin/users/:id', authenticateAdmin.handle, adminUserController.show);
router.get('/admin/users/:id/words', authenticateAdmin.handle, adminUserController.words);
router.put('/admin/users/:id', authenticateAdmin.handle, adminUserController.update);
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
