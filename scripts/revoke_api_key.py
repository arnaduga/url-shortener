#!/usr/bin/env python3
"""
Script to revoke an API key by changing its status to 'revoked'.

Usage:
    python scripts/revoke_api_key.py <api_key_or_hash>

Examples:
    # Revoke using full API key
    python scripts/revoke_api_key.py sk_live_abc123...

    # Revoke using key hash (first 16 chars shown in list)
    python scripts/revoke_api_key.py 1a2b3c4d5e6f7g8h

    # Revoke by name (interactive search)
    python scripts/revoke_api_key.py --by-name "Production App"
"""

import boto3
import sys
import hashlib
from datetime import datetime, timezone
from botocore.exceptions import ClientError

# Import shared configuration
from config import AWS_REGION, API_KEYS_TABLE


def revoke_by_key(api_key):
    """Revoke an API key using the full key"""
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    return revoke_by_hash(key_hash)


def revoke_by_hash(key_hash):
    """Revoke an API key using its hash"""
    dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
    table = dynamodb.Table(API_KEYS_TABLE)

    try:
        # Get the key details first
        response = table.get_item(Key={'key_hash': key_hash})

        if 'Item' not in response:
            print(f"❌ API key not found with hash: {key_hash[:16]}...")
            return False

        item = response['Item']
        name = item.get('name', 'Unknown')
        status = item.get('status', 'unknown')

        print(f"\n📋 API Key Details:")
        print(f"   Name:       {name}")
        print(f"   Status:     {status}")
        print(f"   Created:    {item.get('created_at', 'N/A')}")
        print(f"   Created by: {item.get('created_by', 'N/A')}")
        print(f"   Last used:  {item.get('last_used', 'Never')}\n")

        if status == 'revoked':
            print("⚠️  This API key is already revoked")
            return False

        # Confirm revocation
        confirm = input("❓ Are you sure you want to revoke this API key? (yes/no): ")
        if confirm.lower() not in ['yes', 'y']:
            print("❌ Revocation cancelled")
            return False

        # Update status to revoked
        table.update_item(
            Key={'key_hash': key_hash},
            UpdateExpression='SET #status = :revoked, revoked_at = :timestamp',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':revoked': 'revoked',
                ':timestamp': datetime.now(timezone.utc).isoformat()
            }
        )

        print(f"\n✅ API key '{name}' has been revoked successfully")
        print("💡 The key will no longer authenticate API requests")
        return True

    except ClientError as e:
        print(f"❌ Error revoking API key: {e.response['Error']['Message']}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return False


def find_by_partial_hash(partial_hash):
    """Find API key by partial hash"""
    dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
    table = dynamodb.Table(API_KEYS_TABLE)

    try:
        response = table.scan()
        items = response.get('Items', [])

        matches = [item for item in items if item['key_hash'].startswith(partial_hash)]

        if len(matches) == 0:
            print(f"❌ No API key found with hash starting with: {partial_hash}")
            return None
        elif len(matches) > 1:
            print(f"⚠️  Multiple API keys found with hash starting with: {partial_hash}")
            print("\n📋 Matches:")
            for item in matches:
                print(f"   - {item.get('name')} ({item['key_hash'][:16]}...)")
            print("\n💡 Please provide more characters to uniquely identify the key")
            return None
        else:
            return matches[0]['key_hash']

    except Exception as e:
        print(f"❌ Error searching for API key: {str(e)}")
        return None


def find_by_name(name):
    """Find API key by name"""
    dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
    table = dynamodb.Table(API_KEYS_TABLE)

    try:
        response = table.scan()
        items = response.get('Items', [])

        # Case-insensitive search
        matches = [item for item in items if item.get('name', '').lower() == name.lower()]

        if len(matches) == 0:
            # Try partial match
            matches = [item for item in items if name.lower() in item.get('name', '').lower()]

        if len(matches) == 0:
            print(f"❌ No API key found with name: {name}")
            return None
        elif len(matches) > 1:
            print(f"⚠️  Multiple API keys found matching: {name}")
            print("\n📋 Matches:")
            for i, item in enumerate(matches, 1):
                status_emoji = "✅" if item.get('status') == 'active' else "❌"
                print(f"   {i}. {status_emoji} {item.get('name')} ({item['key_hash'][:16]}...)")

            choice = input("\n❓ Select key number to revoke (or 'c' to cancel): ")
            if choice.lower() == 'c':
                return None
            try:
                idx = int(choice) - 1
                if 0 <= idx < len(matches):
                    return matches[idx]['key_hash']
                else:
                    print("❌ Invalid selection")
                    return None
            except ValueError:
                print("❌ Invalid input")
                return None
        else:
            return matches[0]['key_hash']

    except Exception as e:
        print(f"❌ Error searching for API key: {str(e)}")
        return None


def main():
    """Main function"""
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    print(f"Table: {API_KEYS_TABLE}")
    print(f"Region: {AWS_REGION}\n")

    # Handle --by-name flag
    if sys.argv[1] == "--by-name":
        if len(sys.argv) < 3:
            print("❌ Error: --by-name requires a name argument")
            sys.exit(1)
        name = sys.argv[2]
        key_hash = find_by_name(name)
        if key_hash:
            revoke_by_hash(key_hash)
    else:
        identifier = sys.argv[1]

        # Check if it's a full API key
        if identifier.startswith('sk_'):
            revoke_by_key(identifier)
        # Check if it's a full hash (64 chars)
        elif len(identifier) == 64:
            revoke_by_hash(identifier)
        # Otherwise, treat as partial hash
        else:
            key_hash = find_by_partial_hash(identifier)
            if key_hash:
                revoke_by_hash(key_hash)


if __name__ == "__main__":
    main()
