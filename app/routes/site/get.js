import express from 'express';

/**
 * rhymo.app/get — one link (and one QR code) for every phone:
 * iPhone and iPad go to the App Store, Android goes to Google Play, and
 * anything else lands on the download part of the home page.
 */
export const APP_STORE = 'https://apps.apple.com/app/id6746544972';
export const GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=com.vitalize.rhymo';

const router = express.Router();
router.get(['/get', '/get/'], (req, res) => {
    const ua = req.get('user-agent') || '';
    const to = /iPhone|iPad|iPod/i.test(ua) ? APP_STORE
        : /Android/i.test(ua) ? GOOGLE_PLAY
        : /^en\b/i.test(req.get('accept-language') || '') ? '/en/#get' : '/#get';
    res.set('Cache-Control', 'no-store').set('Vary', 'User-Agent').redirect(302, to);
});

export default router;
