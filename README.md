# Portfolio Backend - Appwrite Functions

This repository contains the serverless backend for the Portfolio CMS, built using **Appwrite Functions**.

## Structure

```
functions/
├── get-content/          # Public API for fetching content
├── submit-contact/       # Contact form handler
├── admin-auth/           # JWT authentication for CMS
└── crud-content/         # CRUD operations for CMS admin
```

## Setup

1. Install Appwrite CLI: `npm install -g appwrite`
2. Login: `appwrite login`
3. Initialize project: `appwrite init project`
4. Deploy functions: `appwrite deploy function`

## Environment Variables

Each function requires these environment variables set in Appwrite Console:

- `APPWRITE_ENDPOINT` - Your Appwrite Cloud endpoint
- `APPWRITE_FUNCTION_PROJECT_ID` - Your project ID
- `APPWRITE_API_KEY` - Your API key with appropriate scopes
- `DATABASE_ID` - Your database ID
- `JWT_SECRET` - Secret for JWT token generation (admin-auth only)

## Functions

### get-content
- **Trigger**: HTTP GET
- **Purpose**: Fetch public content (projects, skills, about, etc.)
- **Auth**: None required

### submit-contact
- **Trigger**: HTTP POST
- **Purpose**: Save contact form submissions
- **Auth**: None required

### admin-auth
- **Trigger**: HTTP POST
- **Purpose**: Authenticate CMS administrators
- **Auth**: Returns JWT token

### crud-content
- **Trigger**: HTTP POST/PUT/DELETE
- **Purpose**: Create, update, delete CMS content
- **Auth**: JWT token required
