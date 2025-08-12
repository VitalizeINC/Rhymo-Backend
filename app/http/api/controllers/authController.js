import controller from './controller.js';
import jwt from 'jsonwebtoken';
import config from '../../../../config/index.js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { findOrCreateUser } from '../services/socialAuthService.js';
import User from '../../../models/user.js';
import PendingUser from '../../../models/pendingUser.js';
import emailService from '../../../helpers/emailService.js';
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
            const googleClientId = process.env.GOOGLE_AUTH_CLIENT_ID;
            if (!googleClientId) {
                console.error('GOOGLE_AUTH_CLIENT_ID environment variable not set');
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
            const { email, password } = req.body;

            // Validate input
            if (!email || !password) {
                return res.status(400).json({ 
                    error: 'Email and password are required' 
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

            // Check if verified user already exists
            const existingUser = await User.findOne({ email: email.toLowerCase() });
            if (existingUser) {
                return res.status(409).json({ 
                    error: 'User with this email already exists' 
                });
            }

            // Check if pending user exists
            let pendingUser = await PendingUser.findOne({ email: email.toLowerCase() });
            
            if (pendingUser) {
                // Check if the previous verification code is still valid
                if (!pendingUser.isExpired()) {
                    const timeRemaining = Math.ceil((pendingUser.verificationExpires - new Date()) / 1000 / 60);
                    return res.status(429).json({ 
                        error: `Please wait ${timeRemaining} minutes before requesting a new verification code` 
                    });
                }
                
                // Update existing pending user with new verification code
                await pendingUser.generateNewCode();
            } else {
                // Create new pending user
                pendingUser = await PendingUser.createPendingUser(email, password, email.split("@")[0]);
            }

            // Send verification email
            try {
                await emailService.sendEmailVerification(email, pendingUser.verificationCode);
            } catch (emailError) {
                console.error('Email sending failed:', emailError);
                return res.status(500).json({ 
                    error: 'Failed to send verification email. Please try again later.' 
                });
            }

            return res.status(200).json({
                message: 'Verification code has been sent to your email. Please check your inbox and verify your email address.'
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

            // Generate 6-digit password reset code
            const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

            // Store reset code in user document
            user.passwordResetCode = resetCode;
            user.passwordResetExpires = new Date(Date.now() + 1 * 60 * 1000); // 1 minutes
            await user.save();

            // Send password reset email
            try {
                await emailService.sendPasswordResetEmail(email, resetCode, user.name);
            } catch (emailError) {
                console.error('Email sending failed:', emailError);
                // Continue even if email fails for security reasons
            }

            return res.json({
                message: 'If an account with this email exists, a password reset link has been sent.'
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
            const { email, code, newPassword } = req.body;

            // Validate input
            if (!email || !code || !newPassword) {
                return res.status(400).json({ 
                    error: 'Email, code, and new password are required' 
                });
            }

            // Validate password strength
            if (newPassword.length < 6) {
                return res.status(400).json({ 
                    error: 'Password must be at least 6 characters long' 
                });
            }

            // Validate code format (6 digits)
            if (!/^\d{6}$/.test(code)) {
                return res.status(400).json({ 
                    error: 'Invalid code format' 
                });
            }

            // Find user by email
            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user) {
                return res.status(404).json({ 
                    error: 'User not found' 
                });
            }

            // Verify code matches stored code and is not expired
            if (user.passwordResetCode !== code) {
                return res.status(401).json({ 
                    error: 'Invalid reset code' 
                });
            }

            if (user.passwordResetExpires < new Date()) {
                return res.status(401).json({ 
                    error: 'Reset code has expired' 
                });
            }

            // Update password and clear reset code
            user.password = newPassword;
            user.passwordResetCode = null;
            user.passwordResetExpires = null;
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

    async verifyEmail(req, res, next) {
        try {
            const { email, code } = req.body;

            if (!email || !code) {
                return res.status(400).json({ 
                    error: 'Email and verification code are required' 
                });
            }

            // Validate code format (6 digits)
            if (!/^\d{6}$/.test(code)) {
                return res.status(400).json({ 
                    error: 'Invalid code format' 
                });
            }

            // Find pending user by email
            const pendingUser = await PendingUser.findOne({ email: email.toLowerCase() });
            if (!pendingUser) {
                return res.status(404).json({ 
                    error: 'No pending registration found for this email' 
                });
            }

            // Check if verification code is valid
            if (!pendingUser.isValidCode(code)) {
                // Increment attempts for security
                await pendingUser.incrementAttempts();
                
                if (pendingUser.isExpired()) {
                    return res.status(401).json({ 
                        error: 'Verification code has expired' 
                    });
                } else {
                    return res.status(401).json({ 
                        error: 'Invalid verification code' 
                    });
                }
            }

            // Check if too many attempts
            if (pendingUser.attempts >= 5) {
                return res.status(429).json({ 
                    error: 'Too many failed attempts. Please request a new verification code.' 
                });
            }

            // Create verified user
            const newUser = new User({
                name: pendingUser.name,
                email: pendingUser.email,
                password: pendingUser.password,
                emailVerified: true
            });

            await newUser.save();

            // Delete pending user
            await PendingUser.findByIdAndDelete(pendingUser._id);

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

            return res.json({
                data: {
                    token,
                    user: {
                        id: newUser._id,
                        name: newUser.name,
                        email: newUser.email,
                        admin: newUser.admin,
                        emailVerified: newUser.emailVerified
                    }
                },
                message: 'Email verified successfully. Your account has been created.'
            });

        } catch (err) {
            console.error('Email verification error:', err);
            return res.status(500).json({ 
                error: 'Internal server error' 
            });
        }
    }

    async resendVerificationEmail(req, res, next) {
        try {
            const { email } = req.body;

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

            // Find pending user by email
            const pendingUser = await PendingUser.findOne({ email: email.toLowerCase() });
            if (!pendingUser) {
                // Don't reveal if user exists or not for security
                return res.json({
                    message: 'If an account with this email exists, a verification code has been sent.'
                });
            }

            // Check if we can send a new verification code (rate limiting)
            if (!pendingUser.isExpired()) {
                const timeRemaining = Math.ceil((pendingUser.verificationExpires - new Date()) / 1000 / 60); // minutes
                return res.status(429).json({ 
                    error: `Please wait ${timeRemaining} minutes before requesting a new verification code` 
                });
            }

            // Generate new verification code
            await pendingUser.generateNewCode();

            // Send verification email
            try {
                await emailService.sendEmailVerification(email, pendingUser.verificationCode);
            } catch (emailError) {
                console.error('Email sending failed:', emailError);
                return res.status(500).json({ 
                    error: 'Failed to send verification email. Please try again later.' 
                });
            }

            return res.json({
                message: 'If an account with this email exists, a verification code has been sent.'
            });

        } catch (err) {
            console.error('Resend verification email error:', err);
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