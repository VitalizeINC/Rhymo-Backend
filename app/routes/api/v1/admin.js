import express from 'express';
const router = express.Router();

import wordManageController from '../../../http/api/controllers/wordManageController.js';
import emailService from '../../../helpers/emailService.js';

router.get('/admin/checkToken', (req, res) => { res.status(200).json() });

router.get('/admin/getWords', wordManageController.getWords);
router.put('/admin/updateWord', wordManageController.updateWord);
router.delete('/admin/deleteWord', wordManageController.deleteWord);
router.put('/admin/updateWordStatus', wordManageController.updateWordStatus);

// Email queue monitoring endpoints
router.get('/admin/email/queue-status', async (req, res) => {
    try {
        const status = await emailService.getQueueStatus();
        res.status(200).json(status);
    } catch (error) {
        console.error('Error getting email queue status:', error);
        res.status(500).json({ error: 'Failed to get email queue status' });
    }
});

router.delete('/admin/email/clear-queue', async (req, res) => {
    try {
        const clearedCount = await emailService.clearQueue();
        res.status(200).json({ 
            message: `Email queue cleared successfully`, 
            clearedCount 
        });
    } catch (error) {
        console.error('Error clearing email queue:', error);
        res.status(500).json({ error: 'Failed to clear email queue' });
    }
});

export default router;
