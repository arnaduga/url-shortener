# Google OAuth Setup Guide

This guide will walk you through setting up Google OAuth for your URL shortener application.

## Prerequisites

- A Google account
- Access to Google Cloud Console

## Step-by-Step Configuration

### 1. Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account

### 2. Create a New Project (or use existing)

1. Click on the project dropdown at the top of the page
2. Click **"New Project"**
3. Enter project details:
   - **Project name**: `URL Shortener` (or your preferred name)
   - **Organization**: Leave as default or select your organization
4. Click **"Create"**
5. Wait for the project to be created, then select it from the project dropdown

### 3. Enable Google Sign-In API

1. In the left sidebar, navigate to **"APIs & Services"** > **"Library"**
2. Search for **"Google+ API"** or **"Google Identity"**
3. Click on **"Google+ API"**
4. Click **"Enable"**

> **Note**: The Google Sign-In uses the Google+ API for authentication.

### 4. Configure OAuth Consent Screen

1. In the left sidebar, go to **"APIs & Services"** > **"OAuth consent screen"**
2. Select **"External"** user type (unless you have a Google Workspace)
3. Click **"Create"**

**Fill in the required information:**

- **App name**: `URL Shortener` (or your app name)
- **User support email**: Your email address
- **App logo**: (Optional) Upload your app logo
- **Application home page**: `https://example.com`
- **Authorized domains**:
  - Add `example.com`
- **Developer contact information**: Your email address

4. Click **"Save and Continue"**

**Scopes:** 5. Click **"Add or Remove Scopes"** 6. Add the following scopes:

- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`
- `openid`

7. Click **"Update"**
8. Click **"Save and Continue"**

**Test users (for testing phase):** 9. Click **"Add Users"** 10. Add your test email addresses: - `user1@example.com` - `user2@example.com` 11. Click **"Save and Continue"**

12. Review the summary and click **"Back to Dashboard"**

### 5. Create OAuth 2.0 Client ID

1. In the left sidebar, go to **"APIs & Services"** > **"Credentials"**
2. Click **"+ Create Credentials"** at the top
3. Select **"OAuth client ID"**

**Configure the OAuth client:**

4. **Application type**: Select **"Web application"**
5. **Name**: `URL Shortener Web Client`
6. **Authorized JavaScript origins**: Add the following URIs:

   - `https://<yourDomain>`
   - `https://short.<yourDomain>`
   - `http://localhost:8000` (for local testing if needed)

7. **Authorized redirect URIs**: Add:

   - `https://short.<yourDomain>`
   - `https://<yourDomain>`

8. Click **"Create"**

### 6. Get Your Client ID

After creating the OAuth client, a popup will appear with:

- **Client ID**: Something like `123456789-abcdefgh.apps.googleusercontent.com`
- **Client Secret**: (Not needed for frontend OAuth)

**IMPORTANT**: Copy the **Client ID** - you'll need it for configuration!

You can also find it later by:

1. Going to **"APIs & Services"** > **"Credentials"**
2. Finding your OAuth 2.0 Client ID in the list
3. Clicking on it to see the Client ID

### 7. Configure Your Application

Update your `Makefile` with the Client ID:

```makefile
# Authentication
GoogleClientId := YOUR_CLIENT_ID_HERE.apps.googleusercontent.com
```

Replace `YOUR_CLIENT_ID_HERE` with the actual Client ID you copied.

### 8. Publish Your App (Optional - for production)

During development, your app will be in "Testing" mode and only test users can sign in.

To allow anyone to sign in:

1. Go to **"APIs & Services"** > **"OAuth consent screen"**
2. Click **"Publish App"**
3. Confirm by clicking **"Confirm"**

> **Warning**: Once published, your app will be available to all Google users. Make sure your backend authorization (DynamoDB table) is properly configured to restrict access to authorized emails only.

## Security Notes

### Backend Authorization

Even though users can sign in with Google, only emails in your DynamoDB `auth-users` table with `status: active` will be able to create short URLs.

The authorization flow is:

1. User signs in with Google → Gets ID token
2. Frontend sends token to API
3. Lambda Authorizer validates token with Google
4. Lambda Authorizer checks if email is in DynamoDB `auth-users` table
5. Only if both checks pass, the user can create URLs

### Adding Authorized Users

To add authorized users to the DynamoDB table, use the provided script:

```bash
python scripts/add_authorized_user.py user1@example.com
```

Or manually in AWS Console:

1. Go to DynamoDB
2. Find table: `url-shortener-myproject-auth-users-prod`
3. Create item with:
   - `email`: `user@example.com`
   - `status`: `active`

## Troubleshooting

### "This app isn't verified" warning

This is normal during development. Click **"Advanced"** → **"Go to URL Shortener (unsafe)"** to continue.

To remove this warning, you need to complete Google's verification process (only necessary for production).

### "Access blocked: This app's request is invalid"

Check that:

- Your authorized JavaScript origins are correct
- Your authorized redirect URIs match your domain
- You're accessing the app via HTTPS (not HTTP)

### Users can't sign in

Check that:

- The user's email is added as a test user in OAuth consent screen (if app is not published)
- The Client ID in your Makefile-fr is correct
- The Google Sign-In library is loading (check browser console)

## Next Steps

After obtaining your Client ID:

1. Update `Makefile-fr` with your Client ID
2. Deploy the backend: `make -f Makefile-fr deploy`
3. Run the script to populate initial users
4. Deploy the frontend: `make -f Makefile-fr setup_front`
5. Test authentication on https://short.example.com

## Support

For more information, see:

- [Google Sign-In Documentation](https://developers.google.com/identity/gsi/web/guides/overview)
- [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
