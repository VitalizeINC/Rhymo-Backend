# Rhymo-Backend API Documentation

## Overview
Rhymo-Backend is a Persian poetry and rhyming API that provides word management, rhyming functionality, and administrative features. The API is built with Node.js, Express, and MongoDB.

**Base URL:** `http://localhost:3500/api/v1`

## Authentication

### JWT Token Authentication
Most endpoints require JWT token authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Admin Authentication
Admin endpoints require special admin credentials. Only users with admin privileges can access admin functionality. Currently hardcoded to specific user IDs: `noya` or `f4ran`.

### Social Authentication
The API supports social authentication providers with automatic user creation:

- **Apple Sign-In**: Uses Apple's JWT identity tokens
- **Google Sign-In**: Uses Google's ID tokens

**User Creation Flow:**
1. Verify provider token (Apple JWT, Google ID token, etc.)
2. Extract user information (email, name, provider user ID)
3. Find existing user by provider-specific identifier
4. If not found, create new user with safe defaults
5. Issue JWT token with user ID and provider information

**User Storage:**
- Social users are linked via `User.tokens` containing `"<provider>:<providerUserId>"`
- We also store Apple's opaque `user` value as `"apple:<user>"` when provided on first login
- Email and name are stored when available from the provider

---

## Public Endpoints (No Authentication Required)

### 1. User Registration
**POST** `/register`

Start the registration process by sending a verification email.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Validation Rules:**
- `email`: Required, valid email format
- `password`: Required, minimum 6 characters

**Response:**
```json
{
  "message": "Verification code has been sent to your email. Please check your inbox and verify your email address."
}
```

**Error Responses:**
- `400`: `{ "error": "Email and password are required" }`
- `400`: `{ "error": "Invalid email format" }`
- `400`: `{ "error": "Password must be at least 6 characters long" }`
- `409`: `{ "error": "User with this email already exists" }`
- `429`: `{ "error": "Please wait X minutes before requesting a new verification code" }`
- `500`: `{ "error": "Failed to send verification email. Please try again later." }`

**Note:** This endpoint only sends a verification email. The user account is created only after email verification is completed. The name is automatically generated from the email address (part before @).

### 2. User Login (Email/Password)
**POST** `/login`

Authenticate a user with email and password and receive a JWT token.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_id",
      "name": "User Name",
      "email": "user@example.com",
      "admin": false
    }
  }
}
```

**Error Responses:**
- `400`: `{ "error": "Email and password are required" }`
- `401`: `{ "error": "Invalid email or password" }`

### 3. Forgot Password
**POST** `/forgot-password`

Send a password reset code to the user's email.

**Request Body:**
```json
{
  "email": "string"
}
```

**Response:**
```json
{
  "message": "If an account with this email exists, a password reset link has been sent."
}
```

**Error Responses:**
- `400`: `{ "error": "Email is required" }`
- `400`: `{ "error": "Invalid email format" }`

### 4. Reset Password
**POST** `/reset-password`

Reset password using the code sent to email.

**Request Body:**
```json
{
  "email": "string",
  "code": "string",
  "newPassword": "string"
}
```

**Validation Rules:**
- `code`: 6-digit numeric code
- `newPassword`: Minimum 6 characters

**Response:**
```json
{
  "message": "Password has been reset successfully"
}
```

**Error Responses:**
- `400`: `{ "error": "Email, code, and new password are required" }`
- `400`: `{ "error": "Password must be at least 6 characters long" }`
- `400`: `{ "error": "Invalid code format" }`
- `401`: `{ "error": "Invalid reset code" }`
- `401`: `{ "error": "Reset code has expired" }`
- `404`: `{ "error": "User not found" }`

### 5. Verify Email
**POST** `/verify-email`

Complete the registration process by verifying the email address and creating the user account.

**Request Body:**
```json
{
  "email": "string",
  "code": "string"
}
```

**Validation Rules:**
- `code`: 6-digit numeric code

**Response:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_id",
      "name": "User Name",
      "email": "user@example.com",
      "admin": false
    }
  },
  "message": "Email verified successfully. Your account has been created."
}
```

**Error Responses:**
- `400`: `{ "error": "Email and verification code are required" }`
- `400`: `{ "error": "Invalid code format" }`
- `401`: `{ "error": "Invalid verification code" }`
- `401`: `{ "error": "Verification code has expired" }`
- `404`: `{ "error": "No pending registration found for this email" }`
- `429`: `{ "error": "Too many failed attempts. Please request a new verification code." }`

### 6. Resend Verification Email
**POST** `/resend-verification`

Request a new email verification code if the previous one expired or wasn't received.

**Request Body:**
```json
{
  "email": "string"
}
```

**Validation Rules:**
- `email`: Required, valid email format

**Response:**
```json
{
  "message": "If an account with this email exists, a verification code has been sent."
}
```

**Error Responses:**
- `400`: `{ "error": "Email is required" }`
- `400`: `{ "error": "Invalid email format" }`
- `400`: `{ "error": "Email is already verified" }`
- `429`: `{ "error": "Please wait X minutes before requesting a new verification code" }`
- `500`: `{ "error": "Failed to send verification email. Please try again later." }`

**Rate Limiting:**
- Users can only request a new verification code after the previous one expires (10 minutes)
- This prevents spam and abuse of the email service

### 7. Apple Sign-In
**POST** `/auth/apple`

Authenticate a user using Apple Sign-In and receive a JWT token.

**Request Body:**
```json
{
  "credential": {
    "identityToken": "eyJraWQiOiJVYUlJRlkyZlc0IiwiYWxnIjoiUlMyNTYifQ...",
    "email": "user@example.com",
    "fullName": {
      "familyName": "Doe",
      "givenName": "John",
      "middleName": null,
      "namePrefix": null,
      "nameSuffix": null,
      "nickname": null
    },
    "realUserStatus": 1,
    "state": null,
    "user": "000406.145b5725c1c9486aa0c1d0baa615952b.1639"
  }
}
```

**Required Fields:**
- At least one of:
  - `credential.identityToken` (string): Apple's JWT identity token (preferred)
  - `credential.user` (string): Apple's opaque user identifier (only works after first verified login)

**Optional Fields:**
- `credential.email` (string, optional): User's email address (fallback if not in token)

**Response:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- `400`: `{ "error": "identityToken or user is required" }`
- `401`: `{ "error": "Invalid Apple identity token" }`
- `401`: `{ "error": "Invalid Apple token (missing subject)" }`
- `401`: `{ "error": "Unknown Apple user. Please sign in with Apple again." }`

### 8. Google Sign-In
**POST** `/auth/google`

Authenticate a user using Google Sign-In and receive a JWT token.

**Request Body:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE...",
  "user": {
    "id": "google_user_id",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

**Required Fields:**
- `idToken` (string): Google's ID token

**Response:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_id",
      "name": "User Name",
      "email": "user@example.com",
      "admin": false
    }
  }
}
```

**Error Responses:**
- `400`: `{ "error": "idToken is required" }`
- `401`: `{ "error": "Invalid Google identity token" }`
- `401`: `{ "error": "Invalid Google token (missing subject)" }`
- `401`: `{ "error": "Invalid Google token (missing email)" }`
- `500`: `{ "error": "Google authentication not configured" }`

### 9. Token Verification
**POST** `/auth/token`

Verify a JWT token and get decoded user information.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**OR Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**OR Query Parameters:**
```
?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "data": {
    "valid": true,
    "user": {
      "id": "user_id",
      "provider": "apple",
      "iat": 1754672598,
      "exp": 1754758998
    }
  }
}
```

**Error Responses:**
- `400`: `{ "error": "Missing token" }`
- `401`: `{ "error": "Invalid or expired token" }`

---

## Private Endpoints (Require Authentication)

**⚠️ IMPORTANT:** Currently, the private endpoints do not have authentication middleware applied. This is a security issue that needs to be addressed. The endpoints are accessible without authentication.

### 1. Get User Information
**GET** `/user`

Get current user information.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "user_id",
  "name": "User Name",
  "email": "user@example.com",
  "admin": false,
  "emailVerified": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 2. Word Management

#### Suggest Words
**GET** `/suggestWord`

Get word suggestions based on a search string.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `string` (string, required): Search string to find matching words

**Response:**
```json
[
  {
    "_id": "word_id",
    "fullWord": "کلمه",
    "word": "کلمه",
    "heja": ["ک", "ل", "م", "ه"],
    "ava": ["ک", "ل", "م", "ه"],
    "hejaCounter": 4
  }
]
```

#### Remove Word
**DELETE** `/removeWord`

Remove a word from user's saved words.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `id` (string, required): Word ID to remove

**Response:**
```json
{}
```

#### Save Words
**POST** `/saveWords`

Save new words to the database.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "s": "کلمه کامل",
  "data": [
    {
      "id": "word_id",
      "part": "کلمه",
      "db": true,
      "parts": ["ک", "ل", "م", "ه"],
      "phonemes": ["ک", "ل", "م", "ه"]
    }
  ]
}
```

**Response:**
```json
{
  "totalId": "saved_word_id"
}
```

**Note:** The `s` field contains the full word string, and `data` contains an array of word parts with their syllables and phonemes.

### 3. Rhyming Process

#### Get Parts Number
**GET** `/getPartsNumber`

Get available parts numbers for rhyming.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `id` (string, required): Word ID
- `filter` (string, required): Character filter for rhyming
- `partsNumber` (number, optional): Number of parts to rhyme (default: word's total parts)
- `partsSkip` (number, optional): Number of parts to skip from beginning (default: 0)

**Response:**
```json
{
  "numbers": [2, 3, 4],
  "selectedWord": {
    "_id": "word_id",
    "fullWord": "کلمه",
    "hejaCounter": 4
  },
  "mostHejaRhyme": {
    "rhymes": [...]
  }
}
```

**Error Responses:**
- `400`: `{ "error": "Parts number must be greater than 1" }`
- `404`: `{ "error": "Word not found" }`

#### Get Rhymes
**GET** `/getRhymes`

Find rhyming words based on criteria.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `id` (string, required): Word ID
- `filter` (string, required): Character filter for rhyming
- `partsNumber` (number, optional): Number of parts to rhyme (default: word's total parts)
- `partsSkip` (number, optional): Number of parts to skip from beginning (default: 0)

**Response:**
```json
{
  "rhymes": [
    {
      "_id": "rhyme_word_id",
      "fullWord": "کلمه",
      "word": "کلمه",
      "heja": ["ک", "ل", "م", "ه"],
      "ava": ["ک", "ل", "م", "ه"],
      "hejaCounter": 4
    }
  ],
  "fullResponse": ["کلمه"],
  "rhymeAva": ["ک,ل,م,ه"],
  "heja": [["ک", "ل", "م", "ه"]],
  "ids": ["word_id"],
  "highlight": [[0, 3]]
}
```

#### Get Word Details
**POST** `/getWordDetails`

Process a word and get its detailed information.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "string": "کلمه کامل"
}
```

**Response:**
```json
{
  "modalTitle": "کلمه کامل",
  "result": [
    {
      "id": "word_id",
      "part": "کلمه",
      "db": true,
      "parts": ["ک", "ل", "م", "ه"],
      "phonemes": ["ک", "ل", "م", "ه"]
    }
  ],
  "pass": true,
  "totalId": "total_word_id"
}
```

**Note:** The `string` field contains the word to process. The response includes detailed syllable and phoneme analysis for each word part.

---

## Admin Endpoints (Require Admin Authentication)

### 1. Check Admin Token
**GET** `/admin/checkToken`

Verify admin authentication.

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Response:**
```json
{}
```

### 2. Word Management (Admin)

#### Get All Words
**GET** `/admin/getWords`

Get paginated list of all words in the database.

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `search` (string, optional): Search term to filter words
- `approved` (string, optional): Filter by approval status ("1" for approved, "0" for not approved)

**Response:**
```json
{
  "words": {
    "docs": [
      {
        "_id": "word_id",
        "fullWord": "کلمه",
        "word": "کلمه",
        "heja": ["ک", "ل", "م", "ه"],
        "ava": ["ک", "ل", "م", "ه"],
        "hejaCounter": 4,
        "approved": false,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "totalDocs": 100,
    "limit": 25,
    "page": 1,
    "totalPages": 4
  },
  "count": 100
}
```

#### Update Word
**PUT** `/admin/updateWord`

Update word information.

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**
- `id` (string, required): Word ID to update

**Request Body:**
```json
{
  "fullWord": "کلمه جدید",
  "heja": ["ک", "ل", "م", "ه"],
  "ava": ["ک", "ل", "م", "ه"]
}
```

**Response:**
```json
"Word updated successfully"
```

**Error Responses:**
- `409`: "Word already exists"
- `404`: "Word not found or no changes made"
- `500`: Internal server error

#### Delete Word
**DELETE** `/admin/deleteWord`

Delete a word from the database.

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**
- `id` (string, required): Word ID to delete

**Response:**
```json
"Word deleted successfully"
```

#### Update Word Status
**PUT** `/admin/updateWordStatus`

Approve or reject a word.

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**
- `id` (string, required): Word ID to update

**Request Body:**
```json
{
  "approved": true,
  "approvedBy": "admin_user_id"
}
```

**Response:**
```json
"Word status updated successfully"
```

---

## Email Service

The API uses SMTP2GO for email delivery with the following configuration:

### Email Templates

1. **Password Reset Email**: Contains a 6-digit verification code
2. **Email Verification**: Contains a 6-digit verification code  
3. **Welcome Email**: Simple welcome message without frontend links

### Email Configuration

```javascript
Sender Email: Rhymo-noreply@vitalize.dev
API Key: api-92185494F7EF46419713E65A00EE34B9
API Endpoint: https://api.smtp2go.com/v3/email/send
```

### Environment Variables

```bash
SMTP2GO_API_KEY=api-92185494F7EF46419713E65A00EE34B9
FROM_EMAIL=Rhymo-noreply@vitalize.dev
FROM_NAME=Rhymo Team
```

---

## Data Models

### User Model
```javascript
{
  _id: ObjectId,
  name: String (required),
  admin: Boolean (default: false),
  email: String (required, unique, lowercase),
  password: String (required),
  tokens: [String] (default: []),
  rememberToken: String (default: null),
  roles: [ObjectId] (ref: 'Role'),
  passwordResetCode: String (default: null),
  passwordResetExpires: Date (default: null),
  createdAt: Date,
  updatedAt: Date
}
```

### PendingUser Model
```javascript
{
  _id: ObjectId,
  email: String (required, unique, lowercase),
  password: String (required, hashed),
  name: String (required, auto-generated from email),
  verificationCode: String (required),
  verificationExpires: Date (required),
  attempts: Number (default: 0),
  lastAttemptAt: Date (default: Date.now),
  createdAt: Date,
  updatedAt: Date
}
```

### Word Model
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: 'User'),
  fullWord: String (required, unique),
  fullWordWithNimFaseleh: String (required),
  word: String (required),
  heja: [String] (required), // Syllables
  ava: [String] (required), // Phonemes
  avaString: String (required),
  hejaCounter: Number (required),
  nimFaselehPositions: [Number] (required),
  spacePositions: [Number] (required),
  private: Boolean (default: false),
  approved: Boolean (default: false),
  approvedBy: ObjectId (ref: 'User'),
  approvedAt: Date,
  rejected: Boolean (default: false),
  rejectedBy: ObjectId (ref: 'User'),
  rejectedAt: Date,
  rejectedReason: String,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Error Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request (Invalid input)
- `401`: Unauthorized (Invalid or missing token)
- `403`: Forbidden (Invalid credentials)
- `404`: Not Found
- `409`: Conflict (Resource already exists)
- `429`: Too Many Requests (Rate limiting)
- `500`: Internal Server Error

---

## Persian Text Processing

The API handles Persian text with special considerations:

1. **Nim Faseleh (Zero-Width Non-Joiner)**: Character code `0x200C` is converted to spaces
2. **Tashdid (Shadda)**: Character code `1617` is duplicated with the previous character
3. **Vowel Marks**: Characters `1614`, `1615`, `1616` are handled as vowel marks
4. **Special Characters**: 'آ', 'ا', 'ی', 'و' are processed for proper syllable division
5. **Ya and Vav Processing**: Special logic to determine if 'ی' and 'و' act as consonants or vowels

---

## Security Issues & Recommendations

### Current Issues

1. **Missing Authentication Middleware**: Private endpoints are accessible without authentication
2. **Hardcoded Admin IDs**: Admin authentication uses hardcoded user IDs (`noya`, `f4ran`)
3. **No Rate Limiting**: No rate limiting implemented for API endpoints

### Recommendations

1. **Implement Authentication Middleware**: Add JWT verification middleware to private routes
2. **Dynamic Admin System**: Implement proper role-based admin system
3. **Rate Limiting**: Add rate limiting for all endpoints
4. **Input Validation**: Add comprehensive input validation
5. **CORS Configuration**: Configure CORS properly for production

---

## Development

To run the API locally:

1. Install dependencies: `npm install`
2. Set environment variables (DATABASE_URL, etc.)
3. Start the server: `npm start`
4. The API will be available at `http://localhost:3500/api/v1`

### Environment Variables

**Required:**
- `DATABASE_URL`: MongoDB connection string
- `APPLICATION_PORT`: Server port (default: 3500)

**Optional:**
- `APPLE_AUDIENCE`: Comma-separated list of Apple client IDs for audience validation
  - Example: `host.exp.Exponent,com.yourapp.client`
  - If not set, audience validation is skipped (less secure but more flexible)
- `GOOGLE_AUTH_CLIENT_ID`: Google OAuth client ID for Google Sign-In validation
- `SMTP2GO_API_KEY`: SMTP2GO API key for email service
- `FROM_EMAIL`: Sender email address
- `FROM_NAME`: Sender name

---

## Notes

- All timestamps are in ISO 8601 format
- Persian text should be sent in UTF-8 encoding
- JWT tokens expire after 24 hours
- Email verification codes expire after 10 minutes
- Password reset codes expire after 10 minutes
- Registration is a two-step process: 1) Send verification email, 2) Verify email to create account
- User names are automatically generated from email addresses (part before @)
- Pending registrations are stored separately from verified users
- Users can request new verification emails if the previous one expires or wasn't received
- Rate limiting prevents abuse of email verification requests (10-minute cooldown)
- Maximum 5 failed verification attempts before requiring a new code
- Word processing includes complex Persian language rules for syllable division
- The API supports both traditional email/password authentication and modern social authentication
- Admin functionality is available for word management and approval workflows
- Email service is fully functional with SMTP2GO API integration 