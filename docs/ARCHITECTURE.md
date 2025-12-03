# URL Shortener Architecture

## Overview

This project follows a **pure SPA (Single Page Application)** architecture with complete separation between the frontend and the API.

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (SPA)                          │
│              CloudFront + S3 Static Hosting                 │
│                  https://short.<yourDomain>                 │
│                                                             │
│  • React + Vite                                             │
│  • OAuth 2.0 Authorization Code + PKCE (client-side)        │
│  • Tokens stored in localStorage                            │
│  • API calls with Authorization: Bearer <token>             │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (Authorization: Bearer)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API GATEWAY                            │
│                   https://<yourDomain>                      │
│                                                             │
│  Endpoints:                                                 │
│  • POST /create              (authenticated)                │
│  • GET  /{shortid}           (public)                       │
│  • GET  /stats/{shortid}     (authenticated)                │
│                                                             │
│  Authorizer Lambda: Verifies Google ID tokens               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    LAMBDA FUNCTIONS                         │
│                                                             │
│  • ShortenerFunction: URL management                        │
│  • AuthorizerFunction: Token validation                     │
│                                                             │
│  DynamoDB Tables:                                           │
│  • UrlDynamoTable: Shortened URLs                           │
│  • ClicksStatsTable: Weekly statistics                      │
│  • AuthUsersTable: Authorized users                         │
└─────────────────────────────────────────────────────────────┘
```

## OAuth 2.0 Flow with PKCE

### 1. Authentication (Frontend only)

```
┌────────┐                                ┌──────────┐
│        │  1. Initiate OAuth             │          │
│        │  (with PKCE challenge)         │          │
│  SPA   │──────────────────────────────▶ │  Google  │
│        │                                │  OAuth   │
│        │  2. Authorization Code         │          │
│        │ ◀──────────────────────────────│          │
│        │                                │          │
│        │  3. Exchange code for token    │          │
│        │  (with PKCE verifier)          │          │
│        │──────────────────────────────▶ │          │
│        │                                │          │
│        │  4. Google ID Token            │          │
│        │ ◀──────────────────────────────│          │
└────────┘                                └──────────┘
     │
     │ 5. Store token in localStorage
     ▼
```

**No backend involved in authentication!**

### 2. API Calls

```
┌────────┐                                ┌──────────┐
│        │  1. API Call with token        │          │
│        │  Authorization: Bearer <token> │          │
│  SPA   │──────────────────────────────▶ │   API    │
│        │                                │ Gateway  │
│        │                                │     +    │
│        │                                │Authorizer│
│        │  2. Response                   │          │
│        │ ◀──────────────────────────────│          │
└────────┘                                └──────────┘
```

The Authorizer Lambda verifies that:

1. The token is a valid Google ID token
2. The email is in the `AuthUsersTable` with status="active"

## API Endpoints

### POST /create (Authenticated)

Create a shortened link.

**Headers:**

```
Authorization: Bearer <google_id_token>
Content-Type: application/json
```

**Body:**

```json
{
  "long_url": "https://example.com/very/long/url",
  "human_readable": true,
  "ttl_in_days": 7
}
```

**Response:**

```json
{
  "short_id": "abc123",
  "short_url": "https://<yourDomain>/abc123",
  "long_url": "https://example.com/very/long/url",
  "created_at": "2025-01-01T12:00:00",
  "ttl": 1672574400
}
```

### GET /{shortid} (Public)

Redirect to the long URL. No authentication required.

**Response:** 301 Redirect

### GET /stats/{shortid} (Authenticated)

Get statistics for a link.

**Headers:**

```
Authorization: Bearer <google_id_token>
```

**Response:**

```json
{
  "short_id": "abc123",
  "short_url": "https://<yourDomain>/abc123",
  "long_url": "https://example.com/very/long/url",
  "created_at": "2025-01-01T12:00:00",
  "total_hits": 42,
  "weekly_stats": [
    {
      "week": "2025-W01",
      "clicks": 15
    }
  ],
  "total_weekly_clicks": 15
}
```

## Architecture Benefits

### ✅ Security

- **PKCE**: Protection against authorization code interception attacks
- **No exposed client secret**: Client ID is public, but without the secret
- **Google tokens**: Cryptographic validation by Google
- **Domain separation**: Frontend and API on different domains

### ✅ Simplicity

- **No server-side session management**: No cookies, no session database
- **Truly static frontend**: Can be hosted anywhere (S3, CDN, etc.)
- **Stateless API**: Each request is independent

### ✅ Scalability

- **Frontend CDN**: CloudFront caches static assets
- **API Gateway + Lambda**: Automatic scalability
- **DynamoDB**: Serverless database

## Google OAuth Configuration

For PKCE to work, configure your Google OAuth application:

1. **Application type**: Web application
2. **Authorized JavaScript origins**:
   - `https://short.<yourDomain>`
   - `http://localhost:5173` (development)
3. **Authorized redirect URIs**:
   - `https://short.<yourDomain>>/callback`
   - `http://localhost:5173/callback`

**Important note**: You do **NOT need** to configure the Client Secret for PKCE!

## Local Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite proxy (see `vite.config.js`) redirects API calls to your deployed API.

### Environment Variables

Create `.env.development` in the `frontend/` folder:

```bash
VITE_API_ENDPOINT=https://<yourDomain>
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## Authorized Users Management

Add users to the DynamoDB `AuthUsersTable`:

```bash
aws dynamodb put-item \
  --table-name <product>-<project>-auth-users-prod \
  --item '{
    "email": {"S": "user@example.com"},
    "status": {"S": "active"},
    "added_at": {"S": "2025-01-01T12:00:00Z"}
  }'
```

To revoke access, change the status to "revoked".

## Differences from Old Architecture

| Aspect         | Old (Server-side OAuth)            | New (Client-side PKCE)                |
| -------------- | ---------------------------------- | ------------------------------------- |
| OAuth Flow     | Backend exchange code → set cookie | Frontend exchange code → localStorage |
| Auth endpoints | `/auth/callback`, `/auth/verify`   | None!                                 |
| Token storage  | HttpOnly cookie (server)           | localStorage (client)                 |
| API calls      | `credentials: 'include'`           | `Authorization: Bearer`               |
| Session mgmt   | DynamoDB sessions                  | No sessions                           |
| Client Secret  | Required (backend)                 | Not required                          |
| Architecture   | Hybrid SPA/Server                  | Pure SPA                              |

## Security: Why localStorage is OK Here

While `localStorage` is generally less secure than HttpOnly cookies, it's acceptable here because:

1. **PKCE** eliminates the need for client secret
2. **Google ID tokens** have short expiration (1h)
3. **The authorizer** verifies the token on each call
4. **Inactivity timeout** on client side (30 min)
5. **No sensitive data** in the token (just email, name)

For maximum security in production, consider:

- Implementing a refresh token flow
- Using a BFF (Backend-for-Frontend) service
- Adding strict CSP headers
