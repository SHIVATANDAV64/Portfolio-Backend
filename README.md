# Portfolio Backend

Appwrite Functions for portfolio API operations.

## Functions

| Function | Trigger | Auth | Purpose |
|----------|---------|------|---------|
| `get-content` | GET | None | Fetch public content |
| `submit-contact` | POST | None | Save contact submissions |
| `crud-content` | POST | Session | CRUD operations for CMS |

## Structure

```
functions/
├── get-content/
│   ├── src/main.js      # Fetch collections
│   └── package.json
├── submit-contact/
│   ├── src/main.js      # Save contact form
│   └── package.json
└── crud-content/
    ├── src/main.js      # CRUD with auth check
    └── package.json
```

## Setup

1. Install Appwrite CLI:
   ```bash
   npm install -g appwrite-cli
   ```

2. Login:
   ```bash
   appwrite login
   ```

3. Deploy functions:
   ```bash
   appwrite push functions
   ```

## Environment Variables

Set these in **Appwrite Console** for each function:

| Variable | Description |
|----------|-------------|
| `APPWRITE_ENDPOINT` | Appwrite Cloud endpoint |
| `APPWRITE_FUNCTION_PROJECT_ID` | Auto-set by Appwrite |
| `APPWRITE_API_KEY` | API key with required scopes |
| `DATABASE_ID` | `portfolio_cms` |

## Database Collections

| Collection | Required Fields |
|------------|-----------------|
| `hero` | title, subtitle, description, cta_text, cta_link |
| `about` | title, description, image_url |
| `skills` | name, category, icon |
| `projects` | title, category, year, description, image_pc, image_mobile, link |
| `experience` | role, company, start_date, end_date, description |
| `services` | title, description, icon |
| `social_links` | platform, url, icon |
| `messages` | name, email, subject, message, created_at, read |

## Storage

Bucket: `portfolio_images`
- Max size: 10MB
- Allowed: jpg, jpeg, png, webp, gif, svg
- Permissions: read(any), create(users), delete(users)

## Function Details

### get-content
```
GET /?collection=<name>
Returns: { success, documents }
```

### submit-contact
```
POST /
Body: { name, email, subject?, message }
Returns: { success, id }
```

### crud-content
```
POST /
Body: { action, collection, data?, id? }
Actions: list, get, create, update, delete
Auth: Requires Appwrite session with admin label
```
