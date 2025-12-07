#!/usr/bin/env python3
"""
Script to list all API keys in the DynamoDB table.

Usage:
    python scripts/list_api_keys.py [--all]

Examples:
    # List only active API keys (default)
    python scripts/list_api_keys.py

    # List all API keys (including revoked)
    python scripts/list_api_keys.py --all
"""

import boto3
import sys
from datetime import datetime, timezone
from botocore.exceptions import ClientError

# Import shared configuration
from config import AWS_REGION, API_KEYS_TABLE


def list_api_keys(show_all=False):
    """List all API keys in the table"""
    dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
    table = dynamodb.Table(API_KEYS_TABLE)

    try:
        response = table.scan()
        items = response.get('Items', [])

        if not items:
            print("📭 No API keys found in the table")
            return

        # Filter by status if not showing all
        if not show_all:
            items = [item for item in items if item.get('status') == 'active']
            if not items:
                print("📭 No active API keys found")
                print("💡 Use --all flag to see revoked keys")
                return

        # Sort by creation date (newest first)
        items = sorted(items, key=lambda x: x.get('created_at', ''), reverse=True)

        print("\n" + "=" * 120)
        print(f"🔑 API Keys ({len(items)} {'total' if show_all else 'active'}):")
        print("=" * 120)
        print(f"\n{'Name':<25} {'Status':<10} {'Created At':<20} {'Created By':<25} {'Last Used':<20} {'Key Hash':<20}")
        print("-" * 120)

        for item in items:
            name = item.get('name', 'N/A')
            status = item.get('status', 'N/A')
            created_at = item.get('created_at', 'N/A')
            created_by = item.get('created_by', 'N/A')
            last_used = item.get('last_used', 'Never')
            key_hash = item.get('key_hash', 'N/A')

            # Format dates
            if created_at != 'N/A':
                try:
                    dt = datetime.fromisoformat(created_at)
                    created_at = dt.strftime('%Y-%m-%d %H:%M')
                except:
                    created_at = created_at[:16]

            if last_used and last_used != 'Never':
                try:
                    dt = datetime.fromisoformat(last_used)
                    last_used = dt.strftime('%Y-%m-%d %H:%M')
                except:
                    last_used = last_used[:16]

            # Truncate long names
            if len(name) > 24:
                name = name[:21] + "..."

            if len(created_by) > 24:
                created_by = created_by[:21] + "..."

            # Short hash for display
            short_hash = key_hash[:16] + "..." if len(key_hash) > 16 else key_hash

            # Status emoji
            status_emoji = "✅" if status == "active" else "❌"

            print(f"{name:<25} {status_emoji} {status:<8} {created_at:<20} {created_by:<25} {last_used:<20} {short_hash:<20}")

        print("\n" + "=" * 120)

        # Summary
        active_count = sum(1 for item in items if item.get('status') == 'active')
        revoked_count = sum(1 for item in items if item.get('status') == 'revoked')
        used_count = sum(1 for item in items if item.get('last_used'))

        print(f"\n📊 Summary:")
        print(f"   Active keys:  {active_count}")
        print(f"   Revoked keys: {revoked_count}")
        print(f"   Ever used:    {used_count}")
        print()

    except ClientError as e:
        print(f"❌ Error listing API keys: {e.response['Error']['Message']}")
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")


def main():
    """Main function"""
    show_all = "--all" in sys.argv

    print(f"Listing API keys from table: {API_KEYS_TABLE}")
    print(f"Region: {AWS_REGION}")
    print(f"Filter: {'All keys' if show_all else 'Active keys only'}\n")

    list_api_keys(show_all)


if __name__ == "__main__":
    main()
