# Authentication Implementation

This document describes the authentication system implemented for the URL Shortener.

## Overview

The URL shortener now requires Google OAuth authentication to create short URLs. The redirection feature (`/{shortid}`) remains public and does not require authentication.

## Architecture

```
┌─────────────┐
│   Frontend  │ Google Sign-In
│  (S3/CF)    │────────────┐
└──────┬──────┘            │
       │                   ▼
       │ POST /create  ┌────────────┐
       │ + Auth Token  │   Google   │
       │               │   OAuth    │
       ▼               └────────────┘
┌─────────────┐
│ API Gateway │
│   Lambda    │
│ Authorizer  │────────┐
└──────┬──────┘        │
       │               │ Verify Token
       │               │ Check User
       ▼               ▼
┌─────────────┐  ┌──────────────┐
│  Shortener  │  │   DynamoDB   │
│   Lambda    │  │ Auth Users   │
└─────────────┘  └──────────────┘
```

## Components

### Backend

#### 1. DynamoDB Table: `AuthUsersTable`
- **Table Name**: `url-shortener-myproject-auth-users-prod`
- **Primary Key**: `email` (String)
- **Attributes**:
  - `email`: User's email address
  - `status`: `active` or `inactive`
  - `last_login`: ISO timestamp of last successful authentication

#### 2. Lambda Authorizer
- **Location**: `authorizer/authorizer.py`
- **Runtime**: Python 3.10
- **Function**:
  - Validates Google ID token
  - Checks if user email exists in DynamoDB
  - Checks if user status is `active`
  - Updates `last_login` timestamp
  - Returns IAM policy (Allow/Deny)

- **Dependencies**: `google-auth==2.25.2`

#### 3. API Gateway
- **Authorizer**: Custom Lambda authorizer
- **Protected Endpoint**: `POST /create`
- **Public Endpoint**: `GET /{shortid}` (no auth required)
- **Cache TTL**: 300 seconds

### Frontend

#### 1. Google Sign-In Integration
- **Library**: Google Identity Services (GSI)
- **Client ID**: Configured via `GoogleClientId` parameter
- **Token Storage**: localStorage with 12-hour expiry
- **Session Persistence**: Auto-restore on page reload

#### 2. UI Components
- Sign-in button (hidden after auth)
- User avatar and name display
- Sign-out button
- Main form (hidden until authenticated)
- Error messages for unauthorized access

## Configuration

### 1. Google OAuth Setup

Follow the guide in [`docs/GOOGLE_OAUTH_SETUP.md`](./GOOGLE_OAUTH_SETUP.md) to:
1. Create Google Cloud project
2. Configure OAuth consent screen
3. Create OAuth 2.0 Client ID
4. Get your Client ID

### 2. Update Configuration

In `Makefile-fr`:
```makefile
GoogleClientId := YOUR_CLIENT_ID.apps.googleusercontent.com
```

### 3. Authorized Origins

Add these to your Google OAuth configuration:
- `https://example.com`
- `https://short.example.com`

## Deployment

### 1. Deploy Backend

This will create the DynamoDB auth table and Lambda authorizer:

```bash
make -f Makefile-fr deploy
```

### 2. Add Authorized Users

Initialize with default users:
```bash
python scripts/add_authorized_user.py --init
```

Or add individual users:
```bash
python scripts/add_authorized_user.py user@example.com
```

List all users:
```bash
python scripts/add_authorized_user.py --list
```

### 3. Deploy Frontend

```bash
make -f Makefile-fr setup_front
```

## User Management

### Add a User

```bash
python scripts/add_authorized_user.py user@example.com
```

### Add an Inactive User

```bash
python scripts/add_authorized_user.py user@example.com --inactive
```

### Manually via AWS Console

1. Go to DynamoDB Console
2. Select table: `url-shortener-myproject-auth-users-prod`
3. Click "Create item"
4. Add attributes:
   ```json
   {
     "email": "user@example.com",
     "status": "active"
   }
   ```

### Deactivate a User

Update the user's status to `inactive` in DynamoDB:
```json
{
  "email": "user@example.com",
  "status": "inactive"
}
```

## Security

### Token Validation

1. **Google Token Verification**: The authorizer verifies the token signature with Google
2. **Email Verification**: Only Google-verified emails are accepted
3. **Database Check**: User must exist in DynamoDB with `status: active`
4. **Token Expiry**: Tokens are checked for expiration
5. **Session Expiry**: Frontend enforces 12-hour session limit

### Authorization Flow

```
1. User clicks "Sign in with Google"
2. Google OAuth popup appears
3. User authenticates with Google
4. Google returns ID token
5. Frontend stores token in localStorage
6. Frontend sends token with each /create request
7. Lambda Authorizer:
   - Verifies token with Google
   - Checks email is verified
   - Looks up email in DynamoDB
   - Checks status is "active"
   - Updates last_login
8. If all checks pass: Allow
9. If any check fails: Deny (401 Unauthorized)
```

### Public vs Protected Endpoints

| Endpoint | Method | Authentication | Purpose |
|----------|--------|---------------|---------|
| `/create` | POST | **Required** | Create short URL |
| `/{shortid}` | GET | Public | Redirect to long URL |

## Troubleshooting

### "Sign-in failed" Error
- Check that GoogleClientId is correct in Makefile-fr
- Verify authorized origins in Google OAuth configuration
- Check browser console for detailed errors

### "Authentication failed. Please sign in again."
- User's email is not in DynamoDB
- User's status is `inactive`
- Token has expired
- Google token verification failed

### User Can Sign In But Can't Create URLs
- Add user to DynamoDB: `python scripts/add_authorized_user.py user@email.com`
- Check user's status is `active` not `inactive`

### Frontend Not Loading
- Check CloudFront invalidation has completed
- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- Check browser console for JavaScript errors

## Monitoring

### CloudWatch Logs

**Authorizer Logs**:
```
/aws/lambda/url-shortener-myproject-authorizer-prod
```

Check for:
- Token verification failures
- Database lookup errors
- Authorization decisions

**Shortener Function Logs**:
```
/aws/lambda/url-shortener-myproject-prod
```

### DynamoDB Metrics

Monitor:
- Read/Write capacity
- Throttled requests
- User login patterns via `last_login` timestamps

## Initial Users

The system is pre-configured with:
- `user1@example.com`
- `user2@example.com`

These are added automatically when running:
```bash
python scripts/add_authorized_user.py --init
```

## Future Enhancements

Potential improvements:
- Admin UI for user management
- User quotas (max URLs per user)
- Usage analytics per user
- Role-based access (admin/user)
- Email notifications for new user requests
- API key alternative to OAuth for programmatic access
