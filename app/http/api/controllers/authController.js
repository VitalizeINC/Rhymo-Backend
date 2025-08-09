import controller from './controller.js';
import jwt from 'jsonwebtoken';
import config from '../../../../config/index.js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { findOrCreateUser } from '../services/socialAuthService.js';
import User from '../../../models/user.js';
class authController extends controller {

    async appleLogin(req, res, next) {
        try {
            const { identityToken, email: emailFromBody, user: appleOpaqueUser } = req.body || {};

            if (!identityToken && !appleOpaqueUser) {
                return res.status(400).json({ error: 'identityToken or user is required' });
            }

            const appleIssuer = 'https://appleid.apple.com';
            const jwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

            // Audience validation is recommended; allow opting in via env for flexibility
            const audienceEnv = process.env.APPLE_AUDIENCE;
            const expectedAudience = audienceEnv
                ? audienceEnv.split(',').map((s) => s.trim()).filter(Boolean)
                : undefined;

            // Case 1: Verify via identityToken (preferred, first-time or regular secure login)
            if (identityToken) {
                const { payload } = await jwtVerify(identityToken, jwks, {
                    issuer: appleIssuer,
                    audience: expectedAudience,
                });

                const appleUserId = payload.sub;
                const email = payload.email || emailFromBody || null;

                if (!appleUserId) {
                    return res.status(401).json({ error: 'Invalid Apple token (missing subject)' });
                }

                const user = await findOrCreateUser({
                    provider: 'apple',
                    providerUserId: appleUserId,
                    email,
                    name: payload.name || null,
                });

                // Attach opaque Apple user token for future lightweight logins
                if (appleOpaqueUser) {
                    const namespacedToken = `apple:${appleOpaqueUser}`;
                    await User.findByIdAndUpdate(
                        user._id,
                        { $addToSet: { tokens: namespacedToken } },
                        { new: false }
                    ).exec();
                }

                const token = jwt.sign(
                    { id: String(user._id), provider: 'apple' },
                    config.jwt.secret_key,
                    { expiresIn: 60 * 60 * 24 }
                );

                return res.json({ data: { token } });
            }

            // Case 2: No identityToken, but opaque Apple user id provided → reuse stored mapping
            if (appleOpaqueUser) {
                const namespacedToken = `apple:${appleOpaqueUser}`;
                const user = await User.findOne({ tokens: namespacedToken }).exec();
                if (!user) {
                    return res.status(401).json({ error: 'Unknown Apple user. Please sign in with Apple again.' });
                }

                const token = jwt.sign(
                    { id: String(user._id), provider: 'apple' },
                    config.jwt.secret_key,
                    { expiresIn: 60 * 60 * 24 }
                );
                return res.json({ data: { token } });
            }
        } catch (err) {
            console.error('Apple login error:', err);
            return res.status(401).json({ error: 'Invalid Apple identity token' });
        }
    }

    async authToken(req, res) {
        try {
            let token = null;
            const header = req.headers.authorization || req.headers.Authorization;
            if (header && typeof header === 'string' && header.startsWith('Bearer ')) {
                token = header.slice(7);
            } else if (req.body && req.body.token) {
                token = req.body.token;
            } else if (req.query && req.query.token) {
                token = req.query.token;
            }

            if (!token) {
                return res.status(400).json({ error: 'Missing token' });
            }

            const decoded = jwt.verify(token, config.jwt.secret_key);

            return res.json({
                data: {
                    valid: true,
                    user: decoded,
                },
            });
        } catch (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    }


    async login(req, res, next) {
        console.log(req.body)

        if (req.body.username == 'noya' && req.body.password == "09352564849") {
            const token = jwt.sign({ id: req.body.username }, config.jwt.secret_key, {
                expiresIn: 60 * 60 * 24
            })
            return res.json({
                data: {
                    token
                }
            })
        } else if (req.body.username == 'f4ran' && req.body.password == "09128168983") {
            const token = jwt.sign({ id: req.body.username }, config.jwt.secret_key, {
                expiresIn: 60 * 60 * 24
            })
            return res.json({
                data: {
                    token
                }
            })
        } else {
            return res.status(403).json()
        }

        //create token


    }

}


export default new authController();