# Rhyme Finding API Pagination Guide

## Overview

The rhyme finding API now supports pagination to handle large result sets efficiently. This guide explains how to use the pagination features.

## API Endpoint

```
GET /api/v1/private/getRhymes
```

## Query Parameters

### Required Parameters
- `id`: The ID of the word to find rhymes for
- `filter`: Comma-separated filter characters

### Optional Parameters
- `partsNumber`: Number of parts to consider for rhyming (default: word's hejaCounter)
- `partsSkip`: Number of parts to skip from the beginning (default: 0)
- `page`: Page number (default: 1)
- `limit`: Number of items per page (default: 10)
- `professional`: Whether to apply professional filtering (default: true, set to 'false' to disable)

## Example Requests

### Basic pagination
```bash
GET /api/v1/private/getRhymes?id=word123&filter=test&page=1&limit=10
```

### Second page with 5 items
```bash
GET /api/v1/private/getRhymes?id=word123&filter=test&page=2&limit=5
```

### Without professional filtering
```bash
GET /api/v1/private/getRhymes?id=word123&filter=test&professional=false&page=1&limit=20
```

## Response Format

The API now returns paginated results with metadata:

```json
{
  "rhymes": ["word1", "word2", "word3"],
  "fullResponse": ["full word1", "full word2", "full word3"],
  "rhymeAva": ["ava1", "ava2", "ava3"],
  "heja": [["heja1"], ["heja2"], ["heja3"]],
  "ids": ["id1", "id2", "id3"],
  "highlight": [[0, 5], [0, 5], [0, 5]],
  "selectedWord": { /* original word object */ },
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 50,
    "itemsPerPage": 10,
    "hasNextPage": true,
    "hasPrevPage": false,
    "nextPage": 2,
    "prevPage": null
  }
}
```

## Pagination Metadata

- `currentPage`: Current page number
- `totalPages`: Total number of pages
- `totalItems`: Total number of items (after filtering)
- `itemsPerPage`: Number of items per page
- `hasNextPage`: Boolean indicating if there's a next page
- `hasPrevPage`: Boolean indicating if there's a previous page
- `nextPage`: Next page number (null if no next page)
- `prevPage`: Previous page number (null if no previous page)

## Implementation Details

### How Pagination Works

1. **Database Query**: The API fetches more words than needed (3x the limit) to account for filtering
2. **Filtering**: Professional filtering is applied to the fetched words
3. **Pagination**: Results are sliced based on page and limit parameters
4. **Metadata**: Pagination metadata is calculated from the filtered results

### Performance Considerations

- The API fetches 3x the requested limit to ensure enough results after filtering
- If you need more results, you may need to increase the limit parameter
- For very large datasets, consider implementing server-side pagination with cursor-based pagination

## Error Handling

- Invalid page numbers (≤ 0) will default to page 1
- Invalid limit values (≤ 0) will default to 10
- If no results are found, the response will have empty arrays but valid pagination metadata

## Migration Notes

If you're upgrading from the previous version:

1. The API now requires `page` and `limit` parameters for consistent pagination
2. The response format includes a new `pagination` object
3. All existing functionality remains the same, just with pagination support
