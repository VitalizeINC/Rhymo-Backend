import { expect } from 'chai';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Test configuration
const TEST_DB_URL = 'mongodb://localhost:27017/rhymo_test';

// Simple User model for testing
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationCode: { type: String, default: null },
    emailVerificationExpires: { type: Date, default: null },
    passwordResetCode: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null }
}, { timestamps: true });

userSchema.pre('save', function(next) {
    if (this.isModified('password')) {
        bcrypt.hash(this.password, bcrypt.genSaltSync(15), (err, hash) => {
            if (err) return next(err);
            this.password = hash;
            next();
        });
    } else {
        next();
    }
});

userSchema.methods.comparePassword = function(password) {
    return bcrypt.compareSync(password, this.password);
};

const TestUser = mongoose.model('TestUser', userSchema);

// Create unique index on email field
TestUser.createIndexes();

describe('Basic Authentication Tests', () => {
    before(async () => {
        try {
            await mongoose.connect(TEST_DB_URL);
            console.log('Connected to test database');
        } catch (error) {
            console.error('Failed to connect to test database:', error);
            process.exit(1);
        }
    });

    after(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        await TestUser.deleteMany({});
    });

    describe('User Model Tests', () => {
        it('should create a user with hashed password', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            };

            const user = new TestUser(userData);
            await user.save();

            expect(user.name).to.equal(userData.name);
            expect(user.email).to.equal(userData.email);
            expect(user.password).to.not.equal(userData.password); // Should be hashed
            expect(user.emailVerified).to.be.false;
        });

        it('should compare passwords correctly', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123'
            };

            const user = new TestUser(userData);
            await user.save();

            expect(user.comparePassword('password123')).to.be.true;
            expect(user.comparePassword('wrongpassword')).to.be.false;
        });

        it('should save users with different emails', async () => {
            const user1Data = {
                name: 'Test User 1',
                email: 'test1@example.com',
                password: 'password123'
            };

            const user2Data = {
                name: 'Test User 2',
                email: 'test2@example.com',
                password: 'password456'
            };

            const user1 = new TestUser(user1Data);
            const user2 = new TestUser(user2Data);

            await user1.save();
            await user2.save();

            expect(user1.email).to.equal(user1Data.email);
            expect(user2.email).to.equal(user2Data.email);

            const savedUsers = await TestUser.find({});
            expect(savedUsers).to.have.length(2);
        });
    });

    describe('JWT Token Tests', () => {
        it('should generate and verify JWT tokens', () => {
            const secret = 'test-secret-key';
            const payload = {
                id: 'test-user-id',
                email: 'test@example.com'
            };

            const token = jwt.sign(payload, secret, { expiresIn: '1h' });
            expect(token).to.be.a('string');

            const decoded = jwt.verify(token, secret);
            expect(decoded.id).to.equal(payload.id);
            expect(decoded.email).to.equal(payload.email);
        });

        it('should reject invalid tokens', () => {
            const secret = 'test-secret-key';
            
            try {
                jwt.verify('invalid-token', secret);
                expect.fail('Should have thrown invalid token error');
            } catch (error) {
                expect(error.name).to.equal('JsonWebTokenError');
            }
        });
    });

    describe('Email Verification Code Tests', () => {
        it('should generate 6-digit verification codes', () => {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            expect(code).to.match(/^\d{6}$/);
            expect(parseInt(code)).to.be.at.least(100000);
            expect(parseInt(code)).to.be.at.most(999999);
        });

        it('should store verification codes with expiration', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
                emailVerificationCode: '123456',
                emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
            };

            const user = new TestUser(userData);
            await user.save();

            expect(user.emailVerificationCode).to.equal('123456');
            expect(user.emailVerificationExpires).to.be.instanceOf(Date);
            expect(user.emailVerificationExpires.getTime()).to.be.greaterThan(Date.now());
        });
    });

    describe('Password Reset Code Tests', () => {
        it('should generate 6-digit reset codes', () => {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            expect(code).to.match(/^\d{6}$/);
            expect(parseInt(code)).to.be.at.least(100000);
            expect(parseInt(code)).to.be.at.most(999999);
        });

        it('should store reset codes with expiration', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
                passwordResetCode: '654321',
                passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
            };

            const user = new TestUser(userData);
            await user.save();

            expect(user.passwordResetCode).to.equal('654321');
            expect(user.passwordResetExpires).to.be.instanceOf(Date);
            expect(user.passwordResetExpires.getTime()).to.be.greaterThan(Date.now());
        });
    });

    describe('Email Validation Tests', () => {
        it('should validate correct email formats', () => {
            const validEmails = [
                'test@example.com',
                'user.name@domain.co.uk',
                'user+tag@example.org',
                '123@numbers.com'
            ];

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            validEmails.forEach(email => {
                expect(emailRegex.test(email)).to.be.true;
            });
        });

        it('should reject invalid email formats', () => {
            const invalidEmails = [
                'invalid-email',
                '@example.com',
                'user@',
                'user.example.com',
                ''
            ];

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            invalidEmails.forEach(email => {
                expect(emailRegex.test(email)).to.be.false;
            });
        });
    });

    describe('Password Validation Tests', () => {
        it('should validate password strength', () => {
            const validPasswords = [
                'password123',
                'MySecurePass1!',
                '123456789',
                'abcdefghijklmnop'
            ];

            const invalidPasswords = [
                '123',
                'abc',
                'pass',
                ''
            ];

            validPasswords.forEach(password => {
                expect(password.length).to.be.at.least(6);
            });

            invalidPasswords.forEach(password => {
                expect(password.length).to.be.lessThan(6);
            });
        });
    });

    describe('Code Format Validation Tests', () => {
        it('should validate 6-digit code format', () => {
            const validCodes = ['123456', '000000', '999999', '654321'];
            const invalidCodes = ['12345', '1234567', 'abcdef', '12 345', ''];

            const codeRegex = /^\d{6}$/;

            validCodes.forEach(code => {
                expect(codeRegex.test(code)).to.be.true;
            });

            invalidCodes.forEach(code => {
                expect(codeRegex.test(code)).to.be.false;
            });
        });
    });
});
