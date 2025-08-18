# Course Advisor System - JSON-Based Workflow

This document describes the new JSON-based workflow for the Course Advisor System, which separates the parsing of documents from the recommendation generation process.

## Overview

The system now supports a two-step workflow:

1. **Parse and Save**: Parse documents and save the extracted data to JSON format
2. **Load and Recommend**: Load the JSON data and generate course recommendations

This approach provides better data persistence, allows for data inspection, and enables faster recommendation generation without re-parsing documents.

## New API Endpoints

### 1. Parse and Save Documents

**Endpoint**: `POST /api/parse-and-save`

Uploads and parses curriculum, transcript, and available courses files, then saves the extracted data to JSON.

**Request**: Multipart form data with three files:

- `curriculum`: Curriculum document (PDF, DOCX, TXT)
- `transcript`: Student transcript (PDF, XLSX, XLS)
- `availableCourses`: Available courses list (DOCX, TXT)

**Response**:

```json
{
  "success": true,
  "savedFilePath": "./data/parsed_data.json",
  "parsedData": {
    "curriculum": [...],
    "completedCourses": [...],
    "availableCourses": [...],
    "studentInfo": {...},
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "message": "Documents parsed and saved to JSON successfully"
}
```

### 2. Load and Generate Recommendations

**Endpoint**: `POST /api/load-and-recommend`

Loads previously parsed data from JSON and generates course recommendations.

**Request**: No body required

**Response**:

```json
{
  "success": true,
  "progressReport": {...},
  "recommendations": {...},
  "parsedData": {...},
  "message": "Recommendations generated successfully from JSON data"
}
```

### 3. Get Parsed Data

**Endpoint**: `GET /api/parsed-data`

Retrieves the currently stored parsed data as JSON.

**Response**:

```json
{
  "success": true,
  "data": {
    "curriculum": [...],
    "completedCourses": [...],
    "availableCourses": [...],
    "studentInfo": {...},
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

## Data Structure

The JSON data is stored in `./data/parsed_data.json` with the following structure:

```json
{
  "curriculum": [
    {
      "semester": 1,
      "code": "CS101",
      "title": "Introduction to Computer Science",
      "category": "AC",
      "lecture": 3,
      "tutorial": 1,
      "lab": 2,
      "totalCredit": 6,
      "prerequisites": [],
      "ects": 6
    }
  ],
  "completedCourses": [
    [
      "CS101",
      {
        "code": "CS101",
        "title": "Introduction to Computer Science",
        "grade": "A",
        "credits": 6,
        "ects": 6,
        "gradePoints": 4.0,
        "passed": true
      }
    ]
  ],
  "availableCourses": [
    {
      "code": "CS102",
      "title": "Data Structures"
    }
  ],
  "studentInfo": {
    "studentNo": "12345",
    "name": "John Doe",
    "program": "Computer Science"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Usage Examples

### Using the API

1. **Parse and save documents**:

```bash
curl -X POST -F "curriculum=@curriculum.pdf" -F "transcript=@transcript.pdf" -F "availableCourses=@courses.docx" http://localhost:3001/api/parse-and-save
```

2. **Generate recommendations from saved data**:

```bash
curl -X POST http://localhost:3001/api/load-and-recommend
```

3. **Get parsed data**:

```bash
curl -X GET http://localhost:3001/api/parsed-data
```

### Using the JavaScript API

```javascript
const CourseAdvisorSystem = require("./server.js");

async function example() {
  const advisor = new CourseAdvisorSystem();

  // Step 1: Parse and save
  const parseResult = await advisor.parseAndSaveDocuments(
    "curriculum.pdf",
    "transcript.pdf",
    "courses.docx"
  );

  if (parseResult.success) {
    console.log("Data saved to:", parseResult.savedFilePath);

    // Step 2: Load and recommend
    const recommendResult = await advisor.loadAndRecommend();

    if (recommendResult.success) {
      console.log("Recommendations:", recommendResult.recommendations);
      console.log("Progress Report:", recommendResult.progressReport);
    }
  }
}
```

## Benefits of JSON-Based Workflow

1. **Data Persistence**: Parsed data is saved and can be reused without re-parsing documents
2. **Data Inspection**: You can examine the parsed data before generating recommendations
3. **Performance**: Faster recommendation generation by avoiding document parsing
4. **Debugging**: Easier to debug parsing issues by examining the JSON data
5. **Flexibility**: Can modify the JSON data manually if needed
6. **Separation of Concerns**: Clear separation between parsing and recommendation logic

## File Locations

- **Parsed Data**: `./data/parsed_data.json`
- **Uploaded Files**: `./uploads/`
- **Test Script**: `./test-json-workflow.js`

## Testing

Run the test script to see the JSON workflow in action:

```bash
node test-json-workflow.js
```

This will demonstrate the complete workflow with sample data.

## Legacy Support

The original direct processing endpoint (`POST /api/recommend-courses`) is still available for backward compatibility, but the new JSON-based workflow is recommended for better performance and data management.
