# Authentication Tests

This directory contains comprehensive tests for all authentication endpoints in the Rhymo API.

## Test Coverage

### 🔐 Registration Tests
- ✅ Successful user registration
- ✅ Validation of required fields
- ✅ Email format validation
- ✅ Password strength validation
- ✅ Duplicate email prevention
- ✅ Email verification code generation

### 🔑 Login Tests
- ✅ Successful login with valid credentials
- ✅ Invalid email rejection
- ✅ Invalid password rejection
- ✅ Missing fields validation

### 📧 Email Verification Tests
- ✅ Email verification with valid code
- ✅ Invalid code rejection
- ✅ Code format validation (6 digits)
- ✅ Missing fields validation
- ✅ Non-existent user handling

### 🔄 Password Reset Tests
- ✅ Password reset code generation
- ✅ Password reset with valid code
- ✅ Invalid code rejection
- ✅ Code format validation
- ✅ Password strength validation
- ✅ Security (doesn't reveal user existence)

### 🎫 Token Validation Tests
- ✅ Valid token validation
- ✅ Token from Authorization header
- ✅ Token from request body
- ✅ Token from query parameters
- ✅ Invalid token rejection
- ✅ Missing token handling

### 🌐 Social Authentication Tests
- ✅ Apple Sign-In endpoint validation
- ✅ Google Sign-In endpoint validation
- ✅ Missing token handling

### 🔗 Integration Tests
- ✅ Complete registration and verification flow
- ✅ Complete password reset flow

## Running Tests

### Prerequisites
1. MongoDB running locally or accessible via `TEST_DATABASE_URL`
2. Node.js and npm installed
3. All dependencies installed (`npm install`)

### Test Commands

```bash
# Run all tests
npm test

# Run only authentication tests
npm run test:auth

# Run tests in watch mode
npm run test:watch

# Run tests with custom database
TEST_DATABASE_URL=mongodb://localhost:27017/rhymo_test npm test
```

### Environment Variables

Create a `.env.test` file for test-specific configuration:

```env
NODE_ENV=test
TEST_DATABASE_URL=mongodb://localhost:27017/rhymo_test
SMTP2GO_API_KEY=test-api-key
FROM_EMAIL=test@rhymo.com
FROM_NAME=Rhymo Test
FRONTEND_URL=http://localhost:3000
```

## Test Structure

```
test/
├── auth.test.js          # Main authentication tests
├── config.js             # Test configuration
├── run-tests.js          # Test runner script
└── README.md            # This file
```

## Test Features

### 🧹 Database Cleanup
- Clears test database before and after tests
- Clears users before each test case
- Ensures test isolation

### 🔒 Security Testing
- Validates input sanitization
- Tests authentication bypass attempts
- Verifies proper error responses

### 📊 Comprehensive Coverage
- Happy path scenarios
- Error scenarios
- Edge cases
- Integration flows

### ⚡ Performance
- 10-second timeout per test
- Efficient database operations
- Minimal setup/teardown overhead

## Adding New Tests

1. Add test cases to the appropriate describe block in `auth.test.js`
2. Follow the existing pattern for setup and assertions
3. Use descriptive test names
4. Test both success and failure scenarios
5. Update this README if adding new test categories

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Ensure MongoDB is running
   - Check `TEST_DATABASE_URL` environment variable
   - Verify network connectivity

2. **Test Timeout**
   - Increase timeout in package.json scripts
   - Check for hanging database connections
   - Verify email service is not blocking

3. **Email Service Errors**
   - Tests use mock email service in test environment
   - Check SMTP2GO configuration for production

### Debug Mode

Run tests with verbose output:

```bash
DEBUG=* npm test
```

## Contributing

When adding new authentication features:

1. Write tests first (TDD approach)
2. Ensure all existing tests pass
3. Add integration tests for new flows
4. Update documentation
5. Test with different environments
