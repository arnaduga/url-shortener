#!/usr/bin/env python3
"""
Shared configuration module for URL shortener scripts.
Loads configuration from environment variables with validation.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Get the directory containing this script
SCRIPT_DIR = Path(__file__).resolve().parent

# Load .env file if it exists
ENV_FILE = SCRIPT_DIR / '.env'
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)
    print(f"✅ Loaded configuration from {ENV_FILE}")
else:
    print(f"⚠️  No .env file found at {ENV_FILE}")
    print(f"💡 Copy scripts/.env.template to scripts/.env and configure it")


def get_required_env(var_name, description):
    """Get a required environment variable or exit with error"""
    value = os.getenv(var_name)
    if not value:
        print(f"❌ Error: Missing required environment variable: {var_name}")
        print(f"   Description: {description}")
        print(f"\n💡 Please set {var_name} in scripts/.env file")
        print(f"   Example: {var_name}=your_value")
        print(f"\n   Or create scripts/.env from template:")
        print(f"   cp scripts/.env.template scripts/.env")
        sys.exit(1)
    return value


def get_optional_env(var_name, default_value):
    """Get an optional environment variable with a default value"""
    return os.getenv(var_name, default_value)


# Required configuration
AWS_REGION = get_required_env('AWS_REGION', 'AWS region (e.g., eu-west-1)')
PROJECT_NAME = get_required_env('PROJECT_NAME', 'Project name used in table names (e.g., myproject)')

# Optional configuration with defaults
PRODUCT_NAME = get_optional_env('PRODUCT_NAME', 'url-shortener')
ENVIRONMENT = get_optional_env('ENVIRONMENT', 'prod')
DEFAULT_CREATOR = get_optional_env('DEFAULT_CREATOR', 'system')

# Construct table names using the naming convention
# Format: {PRODUCT_NAME}-{PROJECT_NAME}-{table_type}-{ENVIRONMENT}
AUTH_USERS_TABLE = f"{PRODUCT_NAME}-{PROJECT_NAME}-auth-users-{ENVIRONMENT}"
API_KEYS_TABLE = f"{PRODUCT_NAME}-{PROJECT_NAME}-api-keys-{ENVIRONMENT}"
URL_TABLE = f"{PRODUCT_NAME}-{PROJECT_NAME}-url-table-{ENVIRONMENT}"
CLICKS_STATS_TABLE = f"{PRODUCT_NAME}-{PROJECT_NAME}-clicks-stats-{ENVIRONMENT}"


def print_config():
    """Print current configuration"""
    print("\n" + "=" * 80)
    print("📋 Current Configuration:")
    print("=" * 80)
    print(f"AWS Region:          {AWS_REGION}")
    print(f"Project Name:        {PROJECT_NAME}")
    print(f"Product Name:        {PRODUCT_NAME}")
    print(f"Environment:         {ENVIRONMENT}")
    print(f"Default Creator:     {DEFAULT_CREATOR}")
    print("\nTable Names:")
    print(f"  Auth Users:        {AUTH_USERS_TABLE}")
    print(f"  API Keys:          {API_KEYS_TABLE}")
    print(f"  URLs:              {URL_TABLE}")
    print(f"  Click Stats:       {CLICKS_STATS_TABLE}")
    print("=" * 80 + "\n")


def validate_config():
    """Validate that all required configuration is present"""
    errors = []

    # Check AWS region format
    if not AWS_REGION or len(AWS_REGION.split('-')) != 3:
        errors.append(f"AWS_REGION '{AWS_REGION}' doesn't look valid (expected format: us-east-1)")

    # Check project name
    if not PROJECT_NAME or len(PROJECT_NAME) < 2:
        errors.append(f"PROJECT_NAME '{PROJECT_NAME}' is too short (minimum 2 characters)")

    if errors:
        print("❌ Configuration validation failed:")
        for error in errors:
            print(f"   - {error}")
        print(f"\n💡 Please fix the configuration in {ENV_FILE}")
        sys.exit(1)

    return True


# Validate configuration on import
validate_config()


if __name__ == "__main__":
    # If run directly, print the configuration
    print_config()
