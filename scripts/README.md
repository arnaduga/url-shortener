# URL Shortener - Management Scripts

This directory contains Python scripts for managing the URL shortener service.

## Quick Start

### 1. Setup Configuration

```bash
# Copy the environment template
cp .env.template .env

# Edit with your settings
nano .env  # Set PROJECT_NAME and AWS_REGION
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Verify Configuration

```bash
python config.py
```

You should see your configuration displayed. If you get errors about missing environment variables, check your `.env` file.

## Available Scripts

### API Key Management (Machine-to-Machine Auth)

**Generate a new API key:**
```bash
python generate_api_key.py "Production App" --created-by admin@example.com
```

**List all API keys:**
```bash
python list_api_keys.py           # Active only
python list_api_keys.py --all     # Include revoked
```

**Revoke an API key:**
```bash
python revoke_api_key.py sk_live_abc123...        # By full key
python revoke_api_key.py 1a2b3c4d                 # By hash prefix
python revoke_api_key.py --by-name "Production"   # By name (interactive)
```

### User Management (Google OAuth)

**Add authorized user:**
```bash
python add_authorized_user.py user@example.com           # Active user
python add_authorized_user.py user@example.com --inactive # Inactive user
```

**List all users:**
```bash
python add_authorized_user.py --list
```

## Configuration

All scripts use environment variables defined in `.env`:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `AWS_REGION` | Yes | AWS region | `eu-west-1` |
| `PROJECT_NAME` | Yes | Project identifier | `myproject` |
| `PRODUCT_NAME` | No | Product name (default: `url-shortener`) | `url-shortener` |
| `ENVIRONMENT` | No | Environment (default: `prod`) | `prod` |
| `DEFAULT_CREATOR` | No | Default creator for API keys (default: `system`) | `admin@example.com` |

### Finding Your PROJECT_NAME

Your `PROJECT_NAME` is the part of your DynamoDB table names between the product and environment.

For example:
- Table: `url-shortener-**myproject**-auth-users-prod`
- PROJECT_NAME: `myproject`

## Table Naming Convention

Scripts automatically construct table names using:

```
{PRODUCT_NAME}-{PROJECT_NAME}-{table-type}-{ENVIRONMENT}
```

**Generated tables:**
- `url-shortener-myproject-auth-users-prod` - Authorized Google users
- `url-shortener-myproject-api-keys-prod` - API keys for M2M auth
- `url-shortener-myproject-url-table-prod` - Short URLs
- `url-shortener-myproject-clicks-stats-prod` - Click statistics

## Files

| File | Purpose | Git Tracked |
|------|---------|-------------|
| `.env.template` | Configuration template | ✅ Yes |
| `.env` | Your local configuration | ❌ No (gitignored) |
| `config.py` | Shared configuration module | ✅ Yes |
| `requirements.txt` | Python dependencies | ✅ Yes |
| `generate_api_key.py` | Create API keys | ✅ Yes |
| `list_api_keys.py` | List API keys | ✅ Yes |
| `revoke_api_key.py` | Revoke API keys | ✅ Yes |
| `add_authorized_user.py` | Manage Google OAuth users | ✅ Yes |

## Security Best Practices

1. **Never commit `.env`** - It's already gitignored, but double-check
2. **Store API keys securely** - Use environment variables or secrets managers
3. **Rotate keys regularly** - Revoke old keys and generate new ones
4. **Use descriptive names** - Name keys by purpose: "CI/CD", "Mobile App"
5. **Monitor usage** - Check `last_used` timestamps with `list_api_keys.py`
6. **Revoke compromised keys immediately** - Use `revoke_api_key.py`

## Troubleshooting

### Error: "Missing required environment variable: PROJECT_NAME"

**Solution:** Create and configure your `.env` file:
```bash
cp .env.template .env
nano .env  # Set PROJECT_NAME=your_project
```

### Error: "An error occurred (ResourceNotFoundException)"

**Solution:** The DynamoDB table doesn't exist yet. Deploy your CloudFormation stack first:
```bash
cd ../backend
make deploy ENV=prod
```

### Error: "An error occurred (AccessDeniedException)"

**Solution:** Ensure your AWS credentials have DynamoDB permissions:
```bash
# Check your credentials
aws sts get-caller-identity

# Ensure you have permissions for:
# - dynamodb:GetItem
# - dynamodb:PutItem
# - dynamodb:UpdateItem
# - dynamodb:Scan (for list operations)
```

### Scripts can't import config module

**Solution:** Run scripts from the project root or scripts directory:
```bash
# From project root
python scripts/generate_api_key.py "My App"

# From scripts directory
cd scripts
python generate_api_key.py "My App"
```

## AWS Credentials

Scripts use boto3 which looks for credentials in this order:

1. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
2. AWS credentials file (`~/.aws/credentials`)
3. AWS config file (`~/.aws/config`)
4. IAM role (if running on EC2/Lambda)

**Recommended:** Use AWS CLI to configure credentials:
```bash
aws configure
```

## Examples

### Complete Setup

```bash
# 1. Clone repo
git clone <repo-url>
cd url-shortener

# 2. Configure scripts
cp scripts/.env.template scripts/.env
nano scripts/.env  # Set PROJECT_NAME and AWS_REGION

# 3. Install dependencies
pip install -r scripts/requirements.txt

# 4. Deploy infrastructure (creates tables)
cd backend
make deploy ENV=prod

# 5. Add yourself as authorized user
cd ../scripts
python add_authorized_user.py your@email.com

# 6. Generate API key for your app
python generate_api_key.py "My Application" --created-by your@email.com

# 7. Test the API key
curl -X POST https://your-domain.com/create \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Managing Multiple Environments

Use different `.env` files:

```bash
# Production
cp .env .env.prod
# Edit: ENVIRONMENT=prod, PROJECT_NAME=prod-project

# Staging
cp .env .env.staging
# Edit: ENVIRONMENT=staging, PROJECT_NAME=staging-project

# Use with:
export $(cat .env.prod | xargs) && python generate_api_key.py "Prod App"
export $(cat .env.staging | xargs) && python generate_api_key.py "Staging App"
```

## Support

For issues:
1. Check this README
2. Verify configuration: `python config.py`
3. Check AWS CloudWatch logs
4. Review DynamoDB tables in AWS Console
5. See main documentation: `../API_KEYS.md`
