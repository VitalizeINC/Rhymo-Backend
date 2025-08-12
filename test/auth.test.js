// Import test config first to set up environment
import testConfig from './config.js';

import request from 'supertest';
import { expect } from 'chai';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import User from '../app/models/user.js';

// Import your app
import Application from '../app/index.js';

let app;
let server;

describe('Authentication API Tests', () => {
    before(async () => {
        // Initialize the application
        const application = new Application();
        app = application.app;
        server = application.server;
        
        // Connect to test database
        await mongoose.connect(testConfig.test.database);
        
        // Clear test database
        await User.deleteMany({});
    });

    after(async () => {
        // Clean up
        await User.deleteMany({});
        await mongoose.connection.close();
        if (server) {
            server.close();
        }
    });

    beforeEach(async () => {
        // Clear users before each test
        await User.deleteMany({});
    });

    describe('POST /api/v1/register', () => {
        it('should register a new user successfully', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            };

            const response = await request(app)
                .post('/api/v1/register')
                .send(userData)
                .expect(201);

            expect(response.body).to.have.property('data');
            expect(response.body.data).to.have.property('token');
            expect(response.body.data).to.have.property('user');
            expect(response.body.data.user.name).to.equal(userData.name);
            expect(response.body.data.user.email).to.equal(userData.email);
            expect(response.body.data.user.emailVerified).to.be.false;
            expect(response.body.message).to.include('Please check your email for verification');

            // Check if user was saved in database
            const savedUser = await User.findOne({ email: userData.email });
            expect(savedUser).to.exist;
            expect(savedUser.emailVerificationCode).to.match(/^\d{6}$/);
            expect(savedUser.emailVerificationExpires).to.be.instanceOf(Date);
        });

        it('should reject registration with missing fields', async () => {
            const response = await request(app)
                .post('/api/v1/register')
                .send({ name: 'Test User' })
                .expect(400);

            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('Name, email, and password are required');
        });

        it('should reject registration with invalid email format', async () => {
            const userData = {
                name: 'Test User',
                email: 'invalid-email',
                password: 'password123'
            };

            const response = await request(app)
                .post('/api/v1/register')
                .send(userData)
                .expect(400);

            expect(response.body.error).to.include('Invalid email format');
        });

        it('should reject registration with weak password', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: '123'
            };

            const response = await request(app)
                .post('/api/v1/register')
                .send(userData)
                .expect(400);

            expect(response.body.error).to.include('Password must be at least 6 characters long');
        });

        it('should reject registration with existing email', async () => {
            // First registration
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            };

            await request(app)
                .post('/api/v1/register')
                .send(userData)
                .expect(201);

            // Second registration with same email
            const response = await request(app)
                .post('/api/v1/register')
                .send(userData)
                .expect(409);

            expect(response.body.error).to.include('User with this email already exists');
        });
    });

    describe('POST /api/v1/login', () => {
        beforeEach(async () => {
            // Create a test user
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            };

            await request(app)
                .post('/api/v1/register')
                .send(userData);
        });

        it('should login with valid credentials', async () => {
            const loginData = {
                email: 'test@example.com',
                password: 'password123'
            };

            const response = await request(app)
                .post('/api/v1/login')
                .send(loginData)
                .expect(200);

            expect(response.body).to.have.property('data');
            expect(response.body.data).to.have.property('token');
            expect(response.body.data).to.have.property('user');
            expect(response.body.data.user.email).to.equal(loginData.email);
        });

        it('should reject login with invalid email', async () => {
            const loginData = {
                email: 'nonexistent@example.com',
                password: 'password123'
            };

            const response = await request(app)
                .post('/api/v1/login')
                .send(loginData)
                .expect(401);

            expect(response.body.error).to.include('Invalid email or password');
        });

        it('should reject login with invalid password', async () => {
            const loginData = {
                email: 'test@example.com',
                password: 'wrongpassword'
            };

            const response = await request(app)
                .post('/api/v1/login')
                .send(loginData)
                .expect(401);

            expect(response.body.error).to.include('Invalid email or password');
        });

        it('should reject login with missing fields', async () => {
            const response = await request(app)
                .post('/api/v1/login')
                .send({ email: 'test@example.com' })
                .expect(400);

            expect(response.body.error).to.include('Email and password are required');
        });
    });

    describe('POST /api/v1/verify-email', () => {
        let verificationCode;
        let userEmail;

        beforeEach(async () => {
            // Create a test user
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            };

            await request(app)
                .post('/api/v1/register')
                .send(userData);

            // Get the verification code from database
            const user = await User.findOne({ email: userData.email });
            verificationCode = user.emailVerificationCode;
            userEmail = userData.email;
        });

        it('should verify email with valid code', async () => {
            const verifyData = {
                email: userEmail,
                code: verificationCode
            };

            const response = await request(app)
                .post('/api/v1/verify-email')
                .send(verifyData)
                .expect(200);

            expect(response.body.message).to.include('Email verified successfully');

            // Check if user is marked as verified
            const user = await User.findOne({ email: userEmail });
            expect(user.emailVerified).to.be.true;
            expect(user.emailVerificationCode).to.be.null;
        });

        it('should reject verification with invalid code', async () => {
            const verifyData = {
                email: userEmail,
                code: '000000'
            };

            const response = await request(app)
                .post('/api/v1/verify-email')
                .send(verifyData)
                .expect(401);

            expect(response.body.error).to.include('Invalid verification code');
        });

        it('should reject verification with invalid code format', async () => {
            const verifyData = {
                email: userEmail,
                code: '12345' // 5 digits instead of 6
            };

            const response = await request(app)
                .post('/api/v1/verify-email')
                .send(verifyData)
                .expect(400);

            expect(response.body.error).to.include('Invalid code format');
        });

        it('should reject verification with missing fields', async () => {
            const response = await request(app)
                .post('/api/v1/verify-email')
                .send({ email: userEmail })
                .expect(400);

            expect(response.body.error).to.include('Email and verification code are required');
        });

        it('should reject verification for non-existent user', async () => {
            const verifyData = {
                email: 'nonexistent@example.com',
                code: '123456'
            };

            const response = await request(app)
                .post('/api/v1/verify-email')
                .send(verifyData)
                .expect(404);

            expect(response.body.error).to.include('User not found');
        });
    });

    describe('POST /api/v1/forgot-password', () => {
        beforeEach(async () => {
            // Create a test user
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            };

            await request(app)
                .post('/api/v1/register')
                .send(userData);
        });

        it('should send reset code for existing user', async () => {
            const response = await request(app)
                .post('/api/v1/forgot-password')
                .send({ email: 'test@example.com' })
                .expect(200);

            expect(response.body.message).to.include('If an account with this email exists');

            // Check if reset code was generated
            const user = await User.findOne({ email: 'test@example.com' });
            expect(user.passwordResetCode).to.match(/^\d{6}$/);
            expect(user.passwordResetExpires).to.be.instanceOf(Date);
        });

        it('should not reveal if email exists or not', async () => {
            const response = await request(app)
                .post('/api/v1/forgot-password')
                .send({ email: 'nonexistent@example.com' })
                .expect(200);

            expect(response.body.message).to.include('If an account with this email exists');
        });

        it('should reject request with missing email', async () => {
            const response = await request(app)
                .post('/api/v1/forgot-password')
                .send({})
                .expect(400);

            expect(response.body.error).to.include('Email is required');
        });

        it('should reject request with invalid email format', async () => {
            const response = await request(app)
                .post('/api/v1/forgot-password')
                .send({ email: 'invalid-email' })
                .expect(400);

            expect(response.body.error).to.include('Invalid email format');
        });
    });

    describe('POST /api/v1/reset-password', () => {
        let resetCode;
        let userEmail;

        beforeEach(async () => {
            // Create a test user
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            };

            await request(app)
                .post('/api/v1/register')
                .send(userData);

            // Generate reset code
            await request(app)
                .post('/api/v1/forgot-password')
                .send({ email: 'test@example.com' });

            // Get the reset code from database
            const user = await User.findOne({ email: 'test@example.com' });
            resetCode = user.passwordResetCode;
            userEmail = 'test@example.com';
        });

        it('should reset password with valid code', async () => {
            const resetData = {
                email: userEmail,
                code: resetCode,
                newPassword: 'newpassword123'
            };

            const response = await request(app)
                .post('/api/v1/reset-password')
                .send(resetData)
                .expect(200);

            expect(response.body.message).to.include('Password has been reset successfully');

            // Check if password was updated and code cleared
            const user = await User.findOne({ email: userEmail });
            expect(user.passwordResetCode).to.be.null;
            expect(user.passwordResetExpires).to.be.null;

            // Verify new password works
            const loginResponse = await request(app)
                .post('/api/v1/login')
                .send({
                    email: userEmail,
                    password: 'newpassword123'
                })
                .expect(200);

            expect(loginResponse.body.data).to.have.property('token');
        });

        it('should reject reset with invalid code', async () => {
            const resetData = {
                email: userEmail,
                code: '000000',
                newPassword: 'newpassword123'
            };

            const response = await request(app)
                .post('/api/v1/reset-password')
                .send(resetData)
                .expect(401);

            expect(response.body.error).to.include('Invalid reset code');
        });

        it('should reject reset with invalid code format', async () => {
            const resetData = {
                email: userEmail,
                code: '12345', // 5 digits instead of 6
                newPassword: 'newpassword123'
            };

            const response = await request(app)
                .post('/api/v1/reset-password')
                .send(resetData)
                .expect(400);

            expect(response.body.error).to.include('Invalid code format');
        });

        it('should reject reset with weak password', async () => {
            const resetData = {
                email: userEmail,
                code: resetCode,
                newPassword: '123'
            };

            const response = await request(app)
                .post('/api/v1/reset-password')
                .send(resetData)
                .expect(400);

            expect(response.body.error).to.include('Password must be at least 6 characters long');
        });

        it('should reject reset with missing fields', async () => {
            const response = await request(app)
                .post('/api/v1/reset-password')
                .send({ email: userEmail, code: resetCode })
                .expect(400);

            expect(response.body.error).to.include('Email, code, and new password are required');
        });
    });

    describe('POST /api/v1/auth/token', () => {
        let authToken;

        beforeEach(async () => {
            // Create a test user and get token
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            };

            const registerResponse = await request(app)
                .post('/api/v1/register')
                .send(userData);

            authToken = registerResponse.body.data.token;
        });

        it('should validate valid token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/token')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.data.valid).to.be.true;
            expect(response.body.data.user).to.have.property('id');
            expect(response.body.data.user).to.have.property('email');
        });

        it('should validate token from body', async () => {
            const response = await request(app)
                .post('/api/v1/auth/token')
                .send({ token: authToken })
                .expect(200);

            expect(response.body.data.valid).to.be.true;
        });

        it('should validate token from query', async () => {
            const response = await request(app)
                .get(`/api/v1/auth/token?token=${authToken}`)
                .expect(200);

            expect(response.body.data.valid).to.be.true;
        });

        it('should reject invalid token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/token')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body.error).to.include('Invalid or expired token');
        });

        it('should reject missing token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/token')
                .expect(400);

            expect(response.body.error).to.include('Missing token');
        });
    });

    describe('POST /api/v1/auth/apple', () => {
        it('should handle Apple login with valid identity token', async () => {
            // Mock Apple identity token (in real test, you'd use a valid token)
            const mockAppleData = {
                credential: {
                    identityToken: 'mock.apple.identity.token',
                    user: 'mock-apple-user-id'
                }
            };

            const response = await request(app)
                .post('/api/v1/auth/apple')
                .send(mockAppleData)
                .expect(401); // Should fail with mock token

            expect(response.body.error).to.include('Invalid Apple identity token');
        });

        it('should reject Apple login without identity token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/apple')
                .send({})
                .expect(400);

            expect(response.body.error).to.include('identityToken or user is required');
        });
    });

    describe('POST /api/v1/auth/google', () => {
        it('should handle Google login with valid id token', async () => {
            // Mock Google id token (in real test, you'd use a valid token)
            const mockGoogleData = {
                idToken: 'mock.google.id.token',
                user: {
                    id: 'mock-google-user-id',
                    email: 'test@example.com',
                    name: 'Test User'
                }
            };

            const response = await request(app)
                .post('/api/v1/auth/google')
                .send(mockGoogleData)
                .expect(401); // Should fail with mock token

            expect(response.body.error).to.include('Invalid Google identity token');
        });

        it('should reject Google login without id token', async () => {
            const response = await request(app)
                .post('/api/v1/auth/google')
                .send({})
                .expect(400);

            expect(response.body.error).to.include('idToken is required');
        });
    });

    describe('Integration Tests', () => {
        it('should complete full registration and verification flow', async () => {
            // 1. Register user
            const userData = {
                name: 'Integration Test User',
                email: 'integration@example.com',
                password: 'password123'
            };

            const registerResponse = await request(app)
                .post('/api/v1/register')
                .send(userData)
                .expect(201);

            const token = registerResponse.body.data.token;
            expect(token).to.exist;

            // 2. Verify email
            const user = await User.findOne({ email: userData.email });
            const verificationCode = user.emailVerificationCode;

            await request(app)
                .post('/api/v1/verify-email')
                .send({
                    email: userData.email,
                    code: verificationCode
                })
                .expect(200);

            // 3. Login with verified account
            const loginResponse = await request(app)
                .post('/api/v1/login')
                .send({
                    email: userData.email,
                    password: userData.password
                })
                .expect(200);

            expect(loginResponse.body.data.token).to.exist;

            // 4. Validate token
            await request(app)
                .post('/api/v1/auth/token')
                .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
                .expect(200);
        });

        it('should complete full password reset flow', async () => {
            // 1. Register user
            const userData = {
                name: 'Password Reset Test User',
                email: 'passwordreset@example.com',
                password: 'oldpassword123'
            };

            await request(app)
                .post('/api/v1/register')
                .send(userData)
                .expect(201);

            // 2. Request password reset
            await request(app)
                .post('/api/v1/forgot-password')
                .send({ email: userData.email })
                .expect(200);

            // 3. Get reset code
            const user = await User.findOne({ email: userData.email });
            const resetCode = user.passwordResetCode;

            // 4. Reset password
            await request(app)
                .post('/api/v1/reset-password')
                .send({
                    email: userData.email,
                    code: resetCode,
                    newPassword: 'newpassword123'
                })
                .expect(200);

            // 5. Login with new password
            const loginResponse = await request(app)
                .post('/api/v1/login')
                .send({
                    email: userData.email,
                    password: 'newpassword123'
                })
                .expect(200);

            expect(loginResponse.body.data.token).to.exist;
        });
    });
});
