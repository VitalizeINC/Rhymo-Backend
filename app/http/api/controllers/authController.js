import controller from './controller.js';
import jwt from 'jsonwebtoken';
import config from '../../../../config/index.js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { findOrCreateUser } from '../services/socialAuthService.js';
import User from '../../../models/user.js';
class authController extends controller {

    async appleLogin(req, res, next) {
        try {
            const { identityToken, email: emailFromBody, user: appleOpaqueUser } = req.body.credential || {};

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

    async googleLogin(req, res, next) {
        try {
            const { idToken, user: googleUser } = req.body;

            if (!idToken) {
                return res.status(400).json({ error: 'idToken is required' });
            }

            // Verify Google ID token
            const googleIssuer = 'https://accounts.google.com';
            const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

            // Get Google client ID from environment variable
            const googleClientId = process.env.GOOGLE_CLIENT_ID;
            if (!googleClientId) {
                console.error('GOOGLE_CLIENT_ID environment variable not set');
                return res.status(500).json({ error: 'Google authentication not configured' });
            }

            const { payload } = await jwtVerify(idToken, jwks, {
                issuer: googleIssuer,
                audience: googleClientId,
            });

            const googleUserId = payload.sub;
            const email = payload.email;
            const name = payload.name;
            const givenName = payload.given_name;
            const familyName = payload.family_name;
            const picture = payload.picture;

            if (!googleUserId) {
                return res.status(401).json({ error: 'Invalid Google token (missing subject)' });
            }

            if (!email) {
                return res.status(401).json({ error: 'Invalid Google token (missing email)' });
            }

            // Find or create user
            const user = await findOrCreateUser({
                provider: 'google',
                providerUserId: googleUserId,
                email,
                name: name || `${givenName || ''} ${familyName || ''}`.trim(),
            });

            // Store additional Google user info if provided
            if (googleUser && googleUser.id) {
                const namespacedToken = `google:${googleUser.id}`;
                await User.findByIdAndUpdate(
                    user._id,
                    { $addToSet: { tokens: namespacedToken } },
                    { new: false }
                ).exec();
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    id: String(user._id), 
                    provider: 'google',
                    email: user.email,
                    name: user.name
                },
                config.jwt.secret_key,
                { expiresIn: 60 * 60 * 24 } // 24 hours
            );

            return res.json({ 
                data: { 
                    token,
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        admin: user.admin
                    }
                } 
            });

        } catch (err) {
            console.error('Google login error:', err);
            return res.status(401).json({ error: 'Invalid Google identity token' });
        }
    }

    async emailPasswordLogin(req, res, next) {
        try {
            const { email, password } = req.body;

            // Validate input
            if (!email || !password) {
                return res.status(400).json({ 
                    error: 'Email and password are required' 
                });
            }

            // Find user by email
            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user) {
                return res.status(401).json({ 
                    error: 'Invalid email or password' 
                });
            }

            // Verify password
            const isValidPassword = user.comparePassword(password);
            if (!isValidPassword) {
                return res.status(401).json({ 
                    error: 'Invalid email or password' 
                });
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    id: String(user._id), 
                    email: user.email,
                    name: user.name,
                    admin: user.admin 
                },
                config.jwt.secret_key,
                { expiresIn: 60 * 60 * 24 } // 24 hours
            );

            return res.json({
                data: {
                    token,
                    user: {
                        id: user._id,
                        name: user.name,
                        email: user.email,
                        admin: user.admin
                    }
                }
            });

        } catch (err) {
            console.error('Email/Password login error:', err);
            return res.status(500).json({ 
                error: 'Internal server error' 
            });
        }
    }

    async register(req, res, next) {
        try {
            const { name, email, password } = req.body;

            // Validate input
            if (!name || !email || !password) {
                return res.status(400).json({ 
                    error: 'Name, email, and password are required' 
                });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ 
                    error: 'Invalid email format' 
                });
            }

            // Validate password strength (minimum 6 characters)
            if (password.length < 6) {
                return res.status(400).json({ 
                    error: 'Password must be at least 6 characters long' 
                });
            }

            // Check if user already exists
            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (existingUser) {
                return res.status(409).json({ 
                    error: 'User with this email already exists' 
                });
            }

            // Create new user
            const newUser = new User({
                name,
                email: email.toLowerCase(),
                password
            });

            await newUser.save();

            // Generate JWT token
            const token = jwt.sign(
                { 
                    id: String(newUser._id), 
                    email: newUser.email,
                    name: newUser.name,
                    admin: newUser.admin 
                },
                config.jwt.secret_key,
                { expiresIn: 60 * 60 * 24 } // 24 hours
            );

            return res.status(201).json({
                data: {
                    token,
                    user: {
                        id: newUser._id,
                        name: newUser.name,
                        email: newUser.email,
                        admin: newUser.admin
                    }
                },
                message: 'User registered successfully'
            });

        } catch (err) {
            console.error('Registration error:', err);
            return res.status(500).json({ 
                error: 'Internal server error' 
            });
        }
    }

    async forgotPassword(req, res, next) {
        try {
            const { email } = req.body;

            // Validate input
            if (!email) {
                return res.status(400).json({ 
                    error: 'Email is required' 
                });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ 
                    error: 'Invalid email format' 
                });
            }

            // Find user by email
            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user) {
                // Don't reveal if user exists or not for security
                return res.json({
                    message: 'If an account with this email exists, a password reset link has been sent.'
                });
            }

            // Generate reset token (expires in 1 hour)
            const resetToken = jwt.sign(
                { 
                    id: String(user._id),
                    email: user.email,
                    type: 'password_reset'
                },
                config.jwt.secret_key,
                { expiresIn: 60 * 60 } // 1 hour
            );

            // Store reset token in user document
            user.rememberToken = resetToken;
            await user.save();

            // TODO: Send email with reset link
            // For now, we'll return the token in the response
            // In production, you should send this via email
            const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

            return res.json({
                message: 'Password reset link has been sent to your email.',
                data: {
                    resetToken, // Remove this in production
                    resetLink   // Remove this in production
                }
            });

        } catch (err) {
            console.error('Forgot password error:', err);
            return res.status(500).json({ 
                error: 'Internal server error' 
            });
        }
    }

    async resetPassword(req, res, next) {
        try {
            const { token, newPassword } = req.body;

            // Validate input
            if (!token || !newPassword) {
                return res.status(400).json({ 
                    error: 'Token and new password are required' 
                });
            }

            // Validate password strength
            if (newPassword.length < 6) {
                return res.status(400).json({ 
                    error: 'Password must be at least 6 characters long' 
                });
            }

            // Verify reset token
            let decoded;
            try {
                decoded = jwt.verify(token, config.jwt.secret_key);
                
                // Check if it's a password reset token
                if (decoded.type !== 'password_reset') {
                    return res.status(401).json({ 
                        error: 'Invalid reset token' 
                    });
                }
            } catch (err) {
                return res.status(401).json({ 
                    error: 'Invalid or expired reset token' 
                });
            }

            // Find user
            const user = await User.findById(decoded.id);
            if (!user) {
                return res.status(404).json({ 
                    error: 'User not found' 
                });
            }

            // Verify token matches stored token
            if (user.rememberToken !== token) {
                return res.status(401).json({ 
                    error: 'Invalid reset token' 
                });
            }

            // Update password
            user.password = newPassword;
            user.rememberToken = null; // Clear the reset token
            await user.save();

            return res.json({
                message: 'Password has been reset successfully'
            });

        } catch (err) {
            console.error('Reset password error:', err);
            return res.status(500).json({ 
                error: 'Internal server error' 
            });
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
        // For backward compatibility, redirect to email/password login
        return this.emailPasswordLogin(req, res, next);
    }

}

export default new authController();