import dotenv from 'dotenv';

// Load test environment variables
try {
    dotenv.config({ path: '.env.test' });
} catch (error) {
    console.log('No .env.test file found, using defaults');
}

// Set test environment variables if not already set
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/rhymo_test';
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'mongodb://localhost:27017/rhymo_test';
process.env.APPLICATION_PORT = process.env.APPLICATION_PORT || '3501';
process.env.SMTP2GO_API_KEY = process.env.SMTP2GO_API_KEY || 'test-api-key';
process.env.FROM_EMAIL = process.env.FROM_EMAIL || 'test@rhymo.com';
process.env.FROM_NAME = process.env.FROM_NAME || 'Rhymo Test';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
process.env.GOOGLE_AUTH_CLIENT_ID = process.env.GOOGLE_AUTH_CLIENT_ID || 'test-google-client-id';

console.log('Test Database URL:', process.env.DATABASE_URL);

export default {
    test: {
        database: process.env.TEST_DATABASE_URL,
        port: process.env.TEST_PORT || 3501
    }
};
