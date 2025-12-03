import json
import os
import boto3
from datetime import datetime
from google.oauth2 import id_token
from google.auth.transport import requests

dynamodb = boto3.resource('dynamodb')
auth_table_name = os.environ.get('AUTH_USERS_TABLE')
auth_table = dynamodb.Table(auth_table_name)

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
                ':timestamp': datetime.utcnow().isoformat(),
                ':active': 'active'
            },
            ReturnValues='ALL_NEW'
        )
        return True
    except Exception as e:
        # ConditionalCheckFailedException means user doesn't exist or status != active
        print(f"Error checking user authorization: {str(e)}")
        return False

def lambda_handler(event, context):
    """
    Lambda authorizer for API Gateway
    Validates Google ID token from Authorization header (Bearer token)
    This is for client-side PKCE flow where frontend handles OAuth
    """
    print(f"Authorizer event: {json.dumps(event)}")

    # Get token from Authorization header only
    auth_token = event.get('authorizationToken', '')

    if not auth_token.startswith('Bearer '):
        print("No Bearer token provided in Authorization header")
        raise Exception('Unauthorized')

    token = auth_token[7:]
    print("Token found in Authorization header")

    # Get method ARN for policy generation
    method_arn = event.get('methodArn')

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
        context={'email': email}
    )
