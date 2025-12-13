# Appwrite Database Schema

This document defines the database collections for the Portfolio CMS.

## Collections

### 1. `hero`
Main hero section content.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Main title (e.g., "Digital Artisan") |
| `subtitle` | string | No | Subtitle text |
| `description` | string | No | Description paragraph |
| `cta_text` | string | No | Call-to-action button text |
| `cta_link` | string (URL) | No | CTA link destination |

---

### 2. `about`
About section content.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Section title |
| `description` | string | Yes | About text (supports line breaks) |
| `image_url` | string (URL) | No | Profile/about image URL |

---

### 3. `skills`
Skills list with categories.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Skill name (e.g., "React Js") |
| `category` | string | Yes | Category: "tech" or "art" |
| `icon` | string | No | Icon identifier or emoji |

---

### 4. `projects`
Portfolio projects.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Project name |
| `category` | string | Yes | Category (e.g., "Web Development") |
| `year` | string | Yes | Year created |
| `description` | string | No | Project description |
| `image_pc` | string (URL) | Yes | Desktop screenshot URL |
| `image_mobile` | string (URL) | No | Mobile screenshot URL |
| `link` | string (URL) | Yes | Live project URL |

---

### 5. `experience`
Work experience timeline.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | Yes | Job title |
| `company` | string | Yes | Company name |
| `start_date` | string | Yes | Start date |
| `end_date` | string | No | End date (empty = present) |
| `description` | string | No | Role description |

---

### 6. `testimonials`
Client/colleague testimonials.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Person's name |
| `role` | string | No | Their role |
| `company` | string | No | Their company |
| `content` | string | Yes | Testimonial text |
| `avatar` | string (URL) | No | Avatar image URL |

---

### 7. `services`
Services offered.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Service name |
| `description` | string | Yes | Service description |
| `icon` | string | No | Icon identifier |

---

### 8. `social_links`
Social media links.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `platform` | string | Yes | Platform name (e.g., "GitHub") |
| `url` | string (URL) | Yes | Profile URL |
| `icon` | string | No | Icon identifier |

---

### 9. `messages`
Contact form submissions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Sender name |
| `email` | string (email) | Yes | Sender email |
| `subject` | string | No | Message subject |
| `message` | string | Yes | Message content |
| `created_at` | string (datetime) | Yes | Submission timestamp |
| `read` | boolean | No | Read status for admin |

---

### 10. `admin_users`
CMS admin accounts.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string (email) | Yes | Admin email |
| `password_hash` | string | Yes | SHA-256 hashed password |
| `name` | string | No | Admin display name |

---

## Creating in Appwrite Console

1. Go to **Databases** in Appwrite Console
2. Create a new database (e.g., "portfolio_cms")
3. Create each collection with the fields above
4. Set permissions:
   - **Public collections** (hero, about, skills, projects, etc.): Read = Any
   - **Protected collections** (messages, admin_users): Read/Write = API Key only
