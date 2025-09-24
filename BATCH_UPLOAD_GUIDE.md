# Batch Upload API Documentation

## Overview
The batch upload functionality allows admins to upload CSV or Excel files containing word data for bulk processing.

## API Endpoints

### 1. Upload Batch File
**POST** `/api/v1/admin/upload-batch`

Upload a CSV or Excel file containing word data.

**Headers:**
- `Authorization: Bearer <admin_token>`
- `Content-Type: multipart/form-data`

**Body:**
- `file`: CSV or Excel file (required)

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "batchId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "fileName": "sample-batch.csv",
    "status": "uploaded"
  }
}
```

### 2. Get All Batches
**GET** `/api/v1/admin/batches`

Retrieve a paginated list of all uploaded batches.

**Headers:**
- `Authorization: Bearer <admin_token>`

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `status`: Filter by status (uploaded, processing, completed, failed)

**Response:**
```json
{
  "success": true,
  "data": {
    "docs": [...],
    "totalDocs": 10,
    "limit": 10,
    "page": 1,
    "totalPages": 1
  }
}
```

### 3. Get Batch Details
**GET** `/api/v1/admin/batches/:batchId`

Get detailed information about a specific batch including all word records.

**Headers:**
- `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "batch": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "fileName": "sample-batch.csv",
      "status": "completed",
      "totalRecords": 10,
      "processedRecords": 10,
      "progressPercentage": 100
    },
    "wordBatches": [...]
  }
}
```

### 4. Process Batch
**POST** `/api/v1/admin/batches/:batchId/process`

Manually trigger processing of an uploaded batch.

**Headers:**
- `Authorization: Bearer <admin_token>`

**Response:**
```json
{
  "success": true,
  "message": "Batch processing started"
}
```

## File Format

### CSV Format
The CSV file should be tab-separated with the following columns:

| Column | Description | Example |
|--------|-------------|---------|
| grapheme | The written form of the word | واترپولو |
| phoneme | Phonetic representation as tuple | ('v', 'A', 't', 'e', 'r', 'p', 'o', 'l', 'o') |
| organized_grapheme | Organized written form | واتِرپولو |
| waw_o_exception_idx | Indices of waw-o exceptions | 5,7 |
| silent_waw_idx | Indices of silent waw | 1 |
| unwritten_A_phone_idx | Indices of unwritten A phonemes | |
| spoken_A_grapheme_idx | Indices of spoken A graphemes | |
| is_variant | Whether this is a variant | TRUE/FALSE |
| variant_num | Variant number | 2 |
| variant_of_index | Index of the original word | 646 |

### Sample CSV Content
```
grapheme	phoneme	organized_grapheme	waw_o_exception_idx	silent_waw_idx	unwritten_A_phone_idx	spoken_A_grapheme_idx	is_variant	variant_num	variant_of_index
واترپولو	('v', 'A', 't', 'e', 'r', 'p', 'o', 'l', 'o')	واتِرپولو	5,7				FALSE
دولوکس	('d', 'o', 'l', 'u', 'k', 's')	دولوکس	1				FALSE
```

## Batch Status

- **uploaded**: File has been uploaded but not yet processed
- **processing**: File is currently being processed
- **completed**: File has been successfully processed
- **failed**: Processing failed with an error

## Models

### Batch Model
Stores information about uploaded files:
- `fileName`: Generated unique filename
- `originalFileName`: Original filename from upload
- `filePath`: Path to stored file
- `fileSize`: File size in bytes
- `mimeType`: MIME type of the file
- `uploadedBy`: Reference to admin user
- `status`: Current processing status
- `totalRecords`: Total number of records in file
- `processedRecords`: Number of successfully processed records
- `failedRecords`: Number of failed records

### WordBatch Model
Stores individual word records from batch files:
- `batch`: Reference to parent batch
- `grapheme`: Written form of the word
- `phoneme`: Array of phonetic sounds
- `organizedGrapheme`: Organized written form
- `wawOExceptionIdx`: Array of waw-o exception indices
- `silentWawIdx`: Array of silent waw indices
- `unwrittenAPhoneIdx`: Array of unwritten A phone indices
- `spokenAGraphemeIdx`: Array of spoken A grapheme indices
- `isVariant`: Boolean indicating if this is a variant
- `variantNum`: Variant number
- `variantOfIndex`: Index of original word
- `rowIndex`: Original row number in file
- `status`: Processing status (pending, processed, failed)

## Error Handling

The API handles various error scenarios:
- Invalid file types (only CSV and Excel allowed)
- File size limits (10MB maximum)
- Authentication required for all endpoints
- Proper error messages for failed processing

## File Storage

Uploaded files are stored in the `uploads/batches/` directory with unique filenames to prevent conflicts.
