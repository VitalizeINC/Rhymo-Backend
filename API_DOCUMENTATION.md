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
Admin endpoints require special admin credentials. Only users with admin privileges can access admin functionality.

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

## Public Endpoints

### 1. User Registration
**POST** `/register`

Register a new user account.

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
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_id",
      "name": "User Name",
      "email": "user@example.com",
      "admin": false,
      "emailVerified": false
    }
  },
  "message": "User registered successfully. Please check your email for verification."
}
```

**Error Responses:**
- `400`: `{ "error": "Name, email, and password are required" }`
- `400`: `{ "error": "Invalid email format" }`
- `400`: `{ "error": "Password must be at least 6 characters long" }`
- `409`: `{ "error": "User with this email already exists" }`

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

Verify user's email address using the verification code.

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
  "message": "Email verified successfully"
}
```

**Error Responses:**
- `400`: `{ "error": "Email and verification code are required" }`
- `400`: `{ "error": "Invalid code format" }`
- `400`: `{ "error": "Email is already verified" }`
- `401`: `{ "error": "Invalid verification code" }`
- `401`: `{ "error": "Verification code has expired" }`
- `404`: `{ "error": "User not found" }`

### 6. Apple Sign-In
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

### 7. Google Sign-In
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

### 8. Token Verification
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

### 2. Email Queue Management (Admin)

#### Get Email Queue Status
**GET** `/admin/email/queue-status`

Get the current status of the email retry queue.

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Response:**
```json
{
  "pending": 5,
  "failed": 2,
  "sent": 150,
  "total": 157,
  "pendingEmails": [
    {
      "to": "user@example.com",
      "subject": "کد تایید ایمیل - Rhymo",
      "retryCount": 1,
      "nextRetry": "2024-01-01T12:30:00.000Z",
      "createdAt": "2024-01-01T12:00:00.000Z",
      "emailType": "verification"
    }
  ],
  "failedEmails": [
    {
      "to": "user@example.com",
      "subject": "کد بازیابی رمز عبور - Rhymo",
      "retryCount": 3,
      "lastError": "SMTP connection failed",
      "createdAt": "2024-01-01T11:00:00.000Z",
      "emailType": "password_reset"
    }
  ]
}
```

#### Clear Email Queue
**DELETE** `/admin/email/clear-queue`

Clear all pending emails from the retry queue.

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
```

**Response:**
```json
{
  "message": "Email queue cleared successfully",
  "clearedCount": 5
}
```

### 3. Word Management (Admin)

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

## Data Models

### User Model
```javascript
{
  _id: ObjectId,
  name: String (required),
  admin: Boolean (default: false),
  email: String (required: false),
  password: String (required),
  tokens: [String] (default: []),
  rememberToken: String (default: null),
  roles: [ObjectId] (ref: 'Role'),
  emailVerified: Boolean (default: false),
  emailVerificationCode: String (default: null),
  emailVerificationExpires: Date (default: null),
  passwordResetCode: String (default: null),
  passwordResetExpires: Date (default: null),
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

### EmailQueue Model
```javascript
{
  _id: ObjectId,
  to: String (required),
  subject: String (required),
  html: String (required),
  text: String (default: null),
  retryCount: Number (default: 0),
  maxRetries: Number (default: 3),
  nextRetryAt: Date (required),
  lastError: String (default: null),
  status: String (enum: ['pending', 'failed', 'sent'], default: 'pending'),
  emailType: String (enum: ['welcome', 'verification', 'password_reset', 'custom'], required),
  metadata: Object (default: {}), // Additional data like user info
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
- `500`: Internal Server Error

---

## Email Retry System

The API includes a robust email retry system to handle delivery failures:

### Features
- **Automatic Retries**: Failed emails are automatically retried with exponential backoff
- **Persistent Queue**: Emails are stored in the database for reliability across server restarts
- **Configurable Retry Limits**: Set maximum retry attempts via `EMAIL_MAX_RETRIES` environment variable
- **Retry Delays**: Progressive delays between retries (5min, 15min, 30min)
- **Queue Monitoring**: Admin endpoints to monitor and manage the email queue
- **Fallback Support**: In-memory queue as fallback if database is unavailable

### Retry Flow
1. Email sending fails
2. Email is queued for retry with metadata (type, user info, etc.)
3. Retry processor runs every minute
4. Emails ready for retry are processed
5. Successful emails are marked as sent
6. Failed emails are retried or marked as permanently failed

### Email Types
- `welcome`: Welcome emails for new users
- `verification`: Email verification codes
- `password_reset`: Password reset codes
- `custom`: Generic emails

## Persian Text Processing

The API handles Persian text with special considerations:

1. **Nim Faseleh (Zero-Width Non-Joiner)**: Character code `0x200C` is converted to spaces
2. **Tashdid (Shadda)**: Character code `1617` is duplicated with the previous character
3. **Vowel Marks**: Characters `1614`, `1615`, `1616` are handled as vowel marks
4. **Special Characters**: 'آ', 'ا', 'ی', 'و' are processed for proper syllable division
5. **Ya and Vav Processing**: Special logic to determine if 'ی' and 'و' act as consonants or vowels

---

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing rate limiting for production use.

---

## CORS

CORS is enabled for all origins. Configure appropriately for production.

---

## Database

The API uses MongoDB with the following connection:
- Connection string: `DATABASE_URL` environment variable
- Database: Configured via environment variables
- Pagination: Uses `mongoose-paginate-v2` for paginated results

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
- `EMAIL_MAX_RETRIES`: Maximum number of email retry attempts (default: 3)
- `USE_DATABASE_EMAIL_QUEUE`: Whether to use database for email queue persistence (default: true)
  - Set to 'false' to use in-memory queue only

---

## Notes

- All timestamps are in ISO 8601 format
- Persian text should be sent in UTF-8 encoding
- JWT tokens expire after 24 hours
- Email verification codes expire after 10 minutes
- Password reset codes expire after 10 minutes
- Word processing includes complex Persian language rules for syllable division
- The API supports both traditional email/password authentication and modern social authentication
- Admin functionality is available for word management and approval workflows 