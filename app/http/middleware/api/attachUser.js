import middleware from '../middleware.js';
import jwt from 'jsonwebtoken';
import config from '../../../../config/index.js';
import { levelsFor } from '../../api/services/userLevels.js';

/**
 * Optional sign-in.
 *
 * Reads the token when one is sent and puts the user on the request, but never
 * refuses a request that has no token. Use it on a route that works for anyone
 * yet should show a signed-in person a little more — the rhyme search, which
 * also returns that person's own words while they wait for approval.
 *
 * authenticateUser is still the one to use when a route must have a user.
 */
class AttachUser extends middleware {
    async handle(req, res, next) {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) return next();

        try {
            req.user = jwt.verify(header.split(' ')[1], config.jwt.secret_key);
            req.user.levels = await levelsFor(req.user.id);
        } catch (error) {
            // A bad or expired token is treated as no token: the caller simply
            // sees what a signed-out visitor sees.
        }
        return next();
    }
}

export default new AttachUser();
