import middleware from '../middleware.js';
import jwt from 'jsonwebtoken';
import config from '../../../../config/index.js';
import User from '../../../models/user.js';
import { accessConfigured, verifyAccess } from './cloudflareAccess.js';

class AuthenticateAdmin extends middleware {
    async handle(req, res, next) {
        // The admin panel is behind Cloudflare Access. Once that is set up
        // (CF_ACCESS_* in .env.local), the Access sign-in is the only way in:
        // whoever Cloudflare let through is an admin, and the old username
        // and password token no longer opens admin routes.
        if (accessConfigured()) {
            let claims = null
            try {
                claims = await verifyAccess(req)
            } catch (error) {
                console.error('Cloudflare Access check failed:', error)
                return res.status(503).json("Could not check the sign-in. Try again.")
            }
            if (!claims || !claims.email) {
                return res.status(401).json("Unauthorized")
            }
            // Link to the Rhymo account with the same email when there is one,
            // so approvedBy and the logs show a real person.
            const email = String(claims.email).toLowerCase()
            const account = await User.findOne({ email }).select('_id')
            req.user = { id: account ? String(account._id) : null, email, admin: true, via: 'cloudflare-access' }
            return next()
        }

        // Before Cloudflare Access is set up: the old admin token.
        let token = req.headers.authorization;
        if (!token) {
            return res.status(401).json("Unauthorized")
        }
        let user
        try {
            user = jwt.verify(token.split(" ")[1], config.jwt.secret_key);
        } catch {
            return res.status(401).json("Unauthorized")
        }
        if (user && user.admin === true) {
            req.user = user;
            return next();
        }
        return res.status(401).json("Unauthorized")
    }
}

export default new AuthenticateAdmin();
