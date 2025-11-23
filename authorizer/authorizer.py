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
    """Check if user email is in authorized users table"""
    try:
        response = auth_table.get_item(Key={'email': email})

        if 'Item' not in response:
            return False

        user = response['Item']

        # Check if user is active
        if user.get('status') != 'active':
            return False

        # Update last_login
        auth_table.update_item(
            Key={'email': email},
            UpdateExpression='SET last_login = :timestamp',
            ExpressionAttributeValues={
                ':timestamp': datetime.utcnow().isoformat()
            }
        )

        return True
    except Exception as e:
        print(f"Error checking user authorization: {str(e)}")
        return False

def lambda_handler(event, context):
    """
    Lambda authorizer for API Gateway
    Validates Google OAuth token and checks user authorization
    """
    print(f"Authorizer event: {json.dumps(event)}")

    # Get the token from Authorization header
    token = event.get('authorizationToken', '')

    # Remove 'Bearer ' prefix if present
    if token.startswith('Bearer '):
        token = token[7:]

    # Get method ARN for policy generation
    method_arn = event.get('methodArn')

    if not token:
        print("No token provided")
        raise Exception('Unauthorized')

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

    # Generate allow policy
    return generate_policy(
        email,
        'Allow',
        method_arn,
        context={'email': email}
    )
