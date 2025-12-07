# API Keys - Machine-to-Machine Authentication

This document describes how to use API keys for machine-to-machine authentication with the URL shortener API.

## Overview

The URL shortener supports two authentication methods:

1. **Google OAuth** - For human users via the web frontend (existing)
2. **API Keys** - For applications and automated scripts (new)

Both methods use the same `Authorization: Bearer <token>` header format and are validated by the same authorizer.

## How It Works

### Authentication Flow

```
Application makes request with API key
         ↓
API Gateway receives request
         ↓
Authorizer Lambda detects API key (starts with 'sk_')
         ↓
Validates key hash in DynamoDB api-keys table
         ↓
Checks status = 'active'
         ↓
Updates last_used timestamp
         ↓
Returns IAM policy to allow/deny access
```

### API Key Format

- Prefix: `sk_live_`
- Random part: 32 URL-safe characters
- Example: `sk_live_abc123def456ghi789jkl012mno345pqr678`

**Security Notes:**

- API keys are hashed (SHA-256) before storage
- The plain key is shown only once during generation
- Lost keys cannot be recovered - generate a new one

## Management Scripts

### 1. Generate API Key

Create a new API key for an application:

```bash
python scripts/generate_api_key.py "Production App" --created-by admin@example.com
```

**Output:**

```
================================================================================
✅ API Key generated successfully!
================================================================================

🔑 API Key (SAVE THIS - it won't be shown again):

   sk_live_abc123def456ghi789jkl012mno345pqr678

================================================================================

📋 Details:
   Name:       Production App
   Created by: admin@example.com
   Created at: 2025-12-07T10:30:00.123456
   Status:     active
   Key hash:   1a2b3c4d5e6f7g8h...
```

⚠️ **Save the API key immediately - it cannot be retrieved later!**

### 2. List API Keys

View all active API keys:

```bash
python scripts/list_api_keys.py
```

View all API keys (including revoked):

```bash
python scripts/list_api_keys.py --all
```

**Output:**

```
========================================================================================================================
🔑 API Keys (3 active):
========================================================================================================================

Name                      Status     Created At           Created By                Last Used            Key Hash
------------------------------------------------------------------------------------------------------------------------
Production App            ✅ active   2025-12-07 10:30     admin@example.com         2025-12-07 14:25     1a2b3c4d5e6f7g8h...
Test Application          ✅ active   2025-12-06 15:20     admin@example.com         Never                9z8y7x6w5v4u3t2s...
Staging Bot               ✅ active   2025-12-05 09:15     system                    2025-12-06 11:45     5a4b3c2d1e0f9g8h...
```

### 3. Revoke API Key

Revoke an API key to immediately disable it:

```bash
# By full API key
python scripts/revoke_api_key.py sk_live_abc123def456ghi789jkl012mno345pqr678

# By partial hash (from list output)
python scripts/revoke_api_key.py 1a2b3c4d5e6f7g8h

# By name (interactive if multiple matches)
python scripts/revoke_api_key.py --by-name "Production App"
```

**Interactive confirmation:**

```
📋 API Key Details:
   Name:       Production App
   Status:     active
   Created:    2025-12-07T10:30:00.123456
   Created by: admin@example.com
   Last used:  2025-12-07T14:25:00.123456

❓ Are you sure you want to revoke this API key? (yes/no): yes

✅ API key 'Production App' has been revoked successfully
💡 The key will no longer authenticate API requests
```

## Usage Examples

### cURL

```bash
curl -X POST https://<yourDomain>/create \
  -H "Authorization: Bearer sk_live_abc123def456ghi789jkl012mno345pqr678" \
  -H "Content-Type: application/json" \
  -d '{"long_url": "https://example.com", "custom_id": "my-link"}'
```

### Python

```python
import requests

API_KEY = "sk_live_abc123def456ghi789jkl012mno345pqr678"
API_URL = "https://<yourDomain>/create"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

response = requests.post(
    API_URL,
    headers=headers,
    json={"long_url": "https://example.com"}
)

print(response.json())
```

### JavaScript/Node.js

```javascript
const API_KEY = "sk_live_abc123def456ghi789jkl012mno345pqr678";
const API_URL = "https://<yourDomain>/create";

fetch(API_URL, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ long_url: "https://example.com" }),
})
  .then((res) => res.json())
  .then((data) => console.log(data));
```

## Configuration

### Setup Environment Variables

All scripts use a shared configuration module that loads settings from environment variables.

**1. Create your local .env file:**

```bash
# Copy the template
cp scripts/.env.template scripts/.env

# Edit the file
nano scripts/.env  # or vim, code, etc.
```

**2. Configure your settings in `scripts/.env`:**

```bash
# AWS Configuration
AWS_REGION=eu-west-1

# Project Configuration
# Example: if your table is "url-shortener-myproject-auth-users-prod"
# then PROJECT_NAME=myproject
PROJECT_NAME=myproject

# These usually stay the same
PRODUCT_NAME=url-shortener
ENVIRONMENT=prod

# Optional: Default creator for API keys
DEFAULT_CREATOR=system
```

**Important:**

- `scripts/.env` is git-ignored and should contain your actual values
- `scripts/.env.template` is tracked in git and serves as a template
- Never commit `scripts/.env` to version control

**3. Install Python dependencies:**

```bash
pip install -r scripts/requirements.txt
```

This installs:

- `boto3` - AWS SDK for Python
- `python-dotenv` - For loading .env files

### Verify Configuration

Test your configuration:

```bash
python scripts/config.py
```

This will display your current settings and validate them.

## DynamoDB Table Structure

**Table Name:** `{ProductName}-{ProjectName}-api-keys-{Environment}`

**Schema:**

- `key_hash` (String, Partition Key) - SHA-256 hash of the API key
- `name` (String) - Human-readable name for the key
- `status` (String) - Either 'active' or 'revoked'
- `created_at` (String, ISO 8601) - When the key was created
- `created_by` (String) - Email or identifier of who created it
- `last_used` (String, ISO 8601) - Last successful authentication
- `revoked_at` (String, ISO 8601) - When it was revoked (if applicable)

## Deployment

The API keys feature requires deploying the updated CloudFormation stack:

```bash
# Deploy to production
make deploy ENV=prod

# Or using SAM directly
sam deploy --config-env prod
```

This will create the new `ApiKeysTable` DynamoDB table.

## Security Best Practices

1. **Store keys securely**

   - Use environment variables or secret managers (AWS Secrets Manager, etc.)
   - Never commit keys to git repositories
   - Rotate keys periodically

2. **Use descriptive names**

   - Name keys by application/purpose: "Production App", "CI/CD Pipeline"
   - Include creator email for accountability

3. **Monitor usage**

   - Check `last_used` timestamps regularly
   - Revoke unused keys

4. **Principle of least privilege**

   - Create separate keys for different applications
   - Revoke compromised keys immediately

5. **Audit trail**
   - The `created_by` and `created_at` fields provide an audit trail
   - CloudWatch logs show all authentication attempts

## Troubleshooting

### "401 Unauthorized" error

**Possible causes:**

1. API key is revoked - check with `list_api_keys.py --all`
2. Incorrect key format - must start with `sk_live_`
3. Key not in database - verify with `list_api_keys.py`
4. Wrong Authorization header format - must be `Bearer <key>`

### "403 Access Denied" error

This typically means:

- The authorizer validated the key but the Lambda function denied access
- Check CloudWatch logs for the authorizer Lambda

### Key generation fails

**Possible causes:**

1. Missing `.env` file - copy from `scripts/.env.template`
2. Table doesn't exist - deploy the CloudFormation stack first
3. IAM permissions - ensure you have DynamoDB write permissions
4. Wrong PROJECT_NAME in `.env` - must match your table naming

### "Missing required environment variable" error

**Solution:**

1. Ensure `scripts/.env` exists: `ls scripts/.env`
2. Check it contains `PROJECT_NAME` and `AWS_REGION`
3. Verify values match your AWS setup
4. Run `python scripts/config.py` to see current configuration

## Migration Notes

### Backward Compatibility

✅ **Existing frontend users are not affected**

- Google OAuth continues to work exactly as before
- No changes required to frontend code
- Both authentication methods work simultaneously

### Testing After Deployment

1. **Test existing Google OAuth** (frontend should work unchanged):

   ```bash
   # Login via frontend - should work as before
   ```

2. **Test new API key authentication**:

   ```bash
   # Generate a test key
   python scripts/generate_api_key.py "Test Key"

   # Try creating a short URL
   curl -X POST https://your-domain.com/create \
     -H "Authorization: Bearer sk_live_..." \
     -H "Content-Type: application/json" \
     -d '{"long_url": "https://example.com"}'
   ```

## Support

For issues or questions:

1. Check CloudWatch logs for the authorizer Lambda
2. Verify table exists: `aws dynamodb describe-table --table-name <table-name>`
3. Review DynamoDB item: `aws dynamodb get-item --table-name <table-name> --key '{"key_hash":{"S":"<hash>"}}'`
