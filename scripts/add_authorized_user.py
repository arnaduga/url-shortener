#!/usr/bin/env python3
"""
Script to add authorized users to the DynamoDB auth table.

Usage:
    python scripts/add_authorized_user.py <email> [--inactive]
    python scripts/add_authorized_user.py --init  # Add initial users
    python scripts/add_authorized_user.py --list  # List all users

Examples:
    # Add a single active user
    python scripts/add_authorized_user.py user@example.com

    # Add an inactive user
    python scripts/add_authorized_user.py user@example.com --inactive

    # List all authorized users
    python scripts/add_authorized_user.py --list
"""

import boto3
import sys
from datetime import datetime, timezone
from botocore.exceptions import ClientError

# Import shared configuration
from config import AWS_REGION, AUTH_USERS_TABLE

# Initial users to add when using --init (customize as needed)
INITIAL_USERS = [
    "user1@example.com",
    "user2@example.com"
]


def add_user(email, status="active"):
    """Add a user to the authorized users table"""
    dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
    table = dynamodb.Table(AUTH_USERS_TABLE)

    try:
        # Check if user already exists
        response = table.get_item(Key={'email': email})

        if 'Item' in response:
            print(f"⚠️  User {email} already exists")
            print(f"   Current status: {response['Item'].get('status', 'unknown')}")

            # Ask if user wants to update
            update = input("   Update status? (y/n): ")
            if update.lower() != 'y':
                return False

        # Add or update user
        item = {
            'email': email,
            'status': status,
            'added_date': datetime.now(timezone.utc).isoformat()
        }

        table.put_item(Item=item)
        print(f"✅ User {email} added successfully with status '{status}'")
        return True

    except ClientError as e:
        print(f"❌ Error adding user {email}: {e.response['Error']['Message']}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return False


def list_users():
    """List all users in the authorized users table"""
    dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
    table = dynamodb.Table(AUTH_USERS_TABLE)

    try:
        response = table.scan()
        items = response.get('Items', [])

        if not items:
            print("📭 No users found in the table")
            return

        print(f"\n📋 Authorized Users ({len(items)} total):\n")
        print(f"{'Email':<40} {'Status':<10} {'Added Date':<20} {'Last Login':<20}")
        print("=" * 100)

        for item in sorted(items, key=lambda x: x.get('email', '')):
            email = item.get('email', 'N/A')
            status = item.get('status', 'N/A')
            added = item.get('added_date', 'N/A')
            last_login = item.get('last_login', 'Never')

            # Format dates
            if added != 'N/A':
                try:
                    added = added[:10]  # Just the date part
                except:
                    pass

            if last_login != 'Never':
                try:
                    last_login = last_login[:10]
                except:
                    pass

            # Status emoji
            status_emoji = "✅" if status == "active" else "❌"

            print(f"{email:<40} {status_emoji} {status:<8} {added:<20} {last_login:<20}")

    except ClientError as e:
        print(f"❌ Error listing users: {e.response['Error']['Message']}")
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")


def init_users():
    """Initialize table with default users"""
    print(f"🚀 Initializing table with {len(INITIAL_USERS)} default users...\n")

    success_count = 0
    for email in INITIAL_USERS:
        if add_user(email, status="active"):
            success_count += 1

    print(f"\n✨ Added {success_count}/{len(INITIAL_USERS)} users successfully")


def main():
    """Main function"""
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    # Handle --init flag
    if command == "--init":
        init_users()
        print("\n" + "="*50)
        list_users()
        return

    # Handle --list flag
    if command == "--list":
        list_users()
        return

    # Add single user
    email = command
    status = "inactive" if "--inactive" in sys.argv else "active"

    print(f"Adding user: {email}")
    print(f"Status: {status}")
    print(f"Table: {AUTH_USERS_TABLE}")
    print(f"Region: {AWS_REGION}\n")

    add_user(email, status)


if __name__ == "__main__":
    main()
