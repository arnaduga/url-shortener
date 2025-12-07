#!/usr/bin/env python3
"""
Script to generate API keys for machine-to-machine authentication.

Usage:
    python scripts/generate_api_key.py <name> [--created-by <email>]

Examples:
    # Generate API key for production app
    python scripts/generate_api_key.py "Production App" --created-by admin@example.com

    # Generate API key with default creator
    python scripts/generate_api_key.py "Test Application"
"""

import boto3
import sys
import secrets
import hashlib
from datetime import datetime, timezone
from botocore.exceptions import ClientError

# Import shared configuration
from config import AWS_REGION, API_KEYS_TABLE, DEFAULT_CREATOR


def generate_api_key(name, created_by=DEFAULT_CREATOR):
    """
    Generate a new API key and store it in DynamoDB
    Returns the API key (shown only once)
    """
    dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
    table = dynamodb.Table(API_KEYS_TABLE)

    # Generate secure random API key
    random_part = secrets.token_urlsafe(32)
    api_key = f"sk_live_{random_part}"

    # Hash the key for storage (we never store the plain key)
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()

    try:
        # Store hashed key in DynamoDB
        item = {
            'key_hash': key_hash,
            'name': name,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'created_by': created_by,
            'status': 'active',
            'last_used': None
        }

        table.put_item(Item=item)

        print("=" * 80)
        print("✅ API Key generated successfully!")
        print("=" * 80)
        print(f"\n🔑 API Key (SAVE THIS - it won't be shown again):\n")
        print(f"   {api_key}\n")
        print("=" * 80)
        print(f"\n📋 Details:")
        print(f"   Name:       {name}")
        print(f"   Created by: {created_by}")
        print(f"   Created at: {item['created_at']}")
        print(f"   Status:     {item['status']}")
        print(f"   Key hash:   {key_hash[:16]}...")
        print(f"\n💡 Usage:")
        print(f"   curl -X POST https://your-domain.com/create \\")
        print(f"     -H 'Authorization: Bearer {api_key}' \\")
        print(f"     -H 'Content-Type: application/json' \\")
        print(f"     -d '{{\"url\": \"https://example.com\"}}'")
        print("\n" + "=" * 80)

        return api_key

    except ClientError as e:
        print(f"❌ Error generating API key: {e.response['Error']['Message']}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return None


def main():
    """Main function"""
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    name = sys.argv[1]
    created_by = DEFAULT_CREATOR

    # Parse --created-by flag
    if "--created-by" in sys.argv:
        try:
            idx = sys.argv.index("--created-by")
            created_by = sys.argv[idx + 1]
        except (IndexError, ValueError):
            print("❌ Error: --created-by requires an email argument")
            sys.exit(1)

    print(f"Generating API key...")
    print(f"Table: {API_KEYS_TABLE}")
    print(f"Region: {AWS_REGION}\n")

    generate_api_key(name, created_by)


if __name__ == "__main__":
    main()
