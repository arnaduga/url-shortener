import json
import os
import boto3
import hashlib
from datetime import datetime, timezone
from google.oauth2 import id_token
from google.auth.transport import requests

dynamodb = boto3.resource('dynamodb')
auth_table_name = os.environ.get('AUTH_USERS_TABLE')
auth_table = dynamodb.Table(auth_table_name)
api_keys_table_name = os.environ.get('API_KEYS_TABLE')
api_keys_table = dynamodb.Table(api_keys_table_name)

def generate_policy(principal_id, effect, resource, context=None):
    """Generate IAM policy for API Gateway"""
    policy = {
        'principalId': principal_id,
        'policyDocument': {
            'Version': '2012-10-17',
            'Statement': [{
                'Action': 'execute-api:Invoke',
                'Effect': effect,
                'Resource': resource
            }]
        }
    }

    if context:
        policy['context'] = context

    return policy

def verify_google_token(token, client_id):
    """Verify Google ID token"""
    try:
        # Verify the token with Google
        idinfo = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            client_id
        )

        # Token is valid
        return {
            'valid': True,
            'email': idinfo.get('email'),
            'email_verified': idinfo.get('email_verified', False)
        }
    except Exception as e:
        print(f"Token verification failed: {str(e)}")
        return {
            'valid': False,
            'error': str(e)
        }

def check_user_authorized(email):
    """Check if user email is in authorized users table (atomic check)"""
    try:
        # Use conditional update to atomically check status and update last_login
        # This prevents race conditions where user is revoked between check and update
        auth_table.update_item(
            Key={'email': email},
            UpdateExpression='SET last_login = :timestamp',
            ConditionExpression='attribute_exists(email) AND #status = :active',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':timestamp': datetime.now(timezone.utc).isoformat(),
                ':active': 'active'
            },
            ReturnValues='ALL_NEW'
        )
        return True
    except Exception as e:
        # ConditionalCheckFailedException means user doesn't exist or status != active
        print(f"Error checking user authorization: {str(e)}")
        return False

def validate_api_key(api_key, method_arn):
    """
    Validate API key from DynamoDB
    Returns IAM policy if valid, raises Exception if invalid
    """
    try:
        # Hash the API key for lookup
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        print(f"Validating API key with hash: {key_hash[:16]}...")

        # Lookup in API keys table and update last_used atomically
        response = api_keys_table.update_item(
            Key={'key_hash': key_hash},
            UpdateExpression='SET last_used = :timestamp',
            ConditionExpression='attribute_exists(key_hash) AND #status = :active',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':timestamp': datetime.now(timezone.utc).isoformat(),
                ':active': 'active'
            },
            ReturnValues='ALL_NEW'
        )

        item = response.get('Attributes', {})
        api_key_name = item.get('name', 'Unknown')
        print(f"API key validated: {api_key_name}")

        # Generate allow policy for ALL resources in this API
        arn_parts = method_arn.split('/')
        base_arn = '/'.join(arn_parts[:2])
        wildcard_arn = f"{base_arn}/*/*"

        return generate_policy(
            f"apikey:{key_hash[:16]}",
            'Allow',
            wildcard_arn,
            context={
                'authType': 'apikey',
                'apiKeyName': api_key_name
            }
        )
    except Exception as e:
        print(f"API key validation failed: {str(e)}")
        raise Exception('Unauthorized')

def lambda_handler(event, context):
    """
    Lambda authorizer for API Gateway
    Supports dual authentication:
    1. Google ID token from Authorization header (Bearer token) - for human users
    2. API Key from Authorization header (Bearer sk_*) - for machine-to-machine
    """
    print(f"Authorizer event: {json.dumps(event)}")

    # Get token from Authorization header
    auth_token = event.get('authorizationToken', '')

    if not auth_token.startswith('Bearer '):
        print("No Bearer token provided in Authorization header")
        raise Exception('Unauthorized')

    token = auth_token[7:]

    # Get method ARN for policy generation
    method_arn = event.get('methodArn')

    # Detect authentication type based on token prefix
    if token.startswith('sk_'):
        # API Key authentication (machine-to-machine)
        print("Detected API key authentication")
        return validate_api_key(token, method_arn)
    else:
        # Google OAuth authentication (human users)
        print("Detected Google OAuth authentication")

        # Get Google Client ID from environment
        google_client_id = os.environ.get('GOOGLE_CLIENT_ID')
        if not google_client_id:
            print("GOOGLE_CLIENT_ID not configured")
            raise Exception('Unauthorized')

        # Verify Google token
        verification_result = verify_google_token(token, google_client_id)

        if not verification_result['valid']:
            print(f"Invalid token: {verification_result.get('error')}")
            raise Exception('Unauthorized')

        if not verification_result.get('email_verified'):
            print("Email not verified")
            raise Exception('Unauthorized')

        email = verification_result['email']
        print(f"Token verified for email: {email}")

        # Check if user is authorized
        if not check_user_authorized(email):
            print(f"User {email} is not authorized")
            raise Exception('Unauthorized')

        print(f"User {email} authorized successfully")

        # Generate allow policy for ALL resources in this API
        # Convert specific method ARN to wildcard to allow all methods/resources
        # Format: arn:aws:execute-api:region:account:api-id/stage/method/resource
        # We want: arn:aws:execute-api:region:account:api-id/stage/*/*
        arn_parts = method_arn.split('/')
        base_arn = '/'.join(arn_parts[:2])  # Get arn:aws:execute-api:region:account:api-id/stage
        wildcard_arn = f"{base_arn}/*/*"

        print(f"Generating policy for: {wildcard_arn}")

        return generate_policy(
            email,
            'Allow',
            wildcard_arn,
            context={
                'authType': 'google',
                'email': email
            }
        )
