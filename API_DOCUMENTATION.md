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
Admin endpoints require special admin credentials. Only users with usernames 'noya' or 'f4ran' can access admin functionality.

### Social Authentication
The API supports social authentication providers with automatic user creation:

- **Apple Sign-In**: Uses Apple's JWT identity tokens
- **Google Sign-In**: Coming soon (uses the same modular system)

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

### 1. User Login
**POST** `/login`

Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Valid Credentials:**
- Username: `noya`, Password: `09352564849`
- Username: `f4ran`, Password: `09128168983`

**Response:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Response (403):**
```json
{}
```

### 2. Apple Sign-In
**POST** `/auth/apple`

Authenticate a user using Apple Sign-In and receive a JWT token.

**Request Body:**
```json
{
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
```

**Required Fields:**
- At least one of:
  - `identityToken` (string): Apple's JWT identity token (preferred)
  - `user` (string): Apple's opaque user identifier (only works after first verified login)

**Optional Fields:**
- `email` (string, optional): User's email address (fallback if not in token)

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

### 3. Token Verification
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
  "username": "username"
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
- `partsNumber` (number, optional): Number of parts to rhyme (default: 2)

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
  ]
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
    "limit": 10,
    "page": 1,
    "totalPages": 10
  }
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
- `401`: Unauthorized (Invalid or missing token)
- `403`: Forbidden (Invalid credentials)
- `404`: Not Found
- `409`: Conflict (Word already exists)
- `500`: Internal Server Error

---

## Persian Text Processing

The API handles Persian text with special considerations:

1. **Nim Faseleh (Zero-Width Non-Joiner)**: Character code `0x200C` is converted to spaces
2. **Tashdid (Shadda)**: Character code `1617` is duplicated with the previous character
3. **Vowel Marks**: Characters `1614`, `1615`, `1616` are handled as vowel marks
4. **Special Characters**: 'آ', 'ا', 'ی', 'و' are processed for proper syllable division

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

---

## Notes

- All timestamps are in ISO 8601 format
- Persian text should be sent in UTF-8 encoding
- JWT tokens expire after 24 hours
- Admin authentication is hardcoded for specific usernames
- Word processing includes complex Persian language rules for syllable division 