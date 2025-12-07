import os
import json
from decimal import Decimal
from botocore.exceptions import ClientError
import boto3
from string import ascii_letters, digits
from random import choice, randint
from time import strftime, time
from datetime import datetime
from urllib import parse
import logging
import validators
import math
import re

# Logging configuration
root = logging.getLogger()
if root.handlers:
    for handler in root.handlers:
        root.removeHandler(handler)
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s", level=logging.INFO
)

# Set variables
domain = os.getenv("DOMAIN")
sub_domain = os.getenv("SUB_DOMAIN")
api_domain = os.getenv("API_DOMAIN")  # Will be either "subdomain.domain" or just "domain"
aws_region = os.getenv("AWS_REGION")
fallback_url = os.getenv("FALLBACK_URL")
table_name = os.getenv("TABLE_NAME")
clicks_stats_table_name = os.getenv("CLICKS_STATS_TABLE")
min_char = int(os.getenv("MIN_CHAR"))
max_char = int(os.getenv("MAX_CHAR"))
custom_min_char = int(os.getenv("CUSTOM_MIN_CHAR"))
custom_max_char = int(os.getenv("CUSTOM_MAX_CHAR"))
string_format = ascii_letters + digits

# Custom ID validation regex: a-z (lowercase only), 0-9, -, _, .
# Does NOT allow consecutive special characters (__, --, .., or combinations)
# Does NOT allow uppercase letters
# Must start and end with alphanumeric
CUSTOM_ID_REGEX = re.compile(r'^[a-z0-9]+([._-]?[a-z0-9]+)*$')

# CORS configuration
website_url = "https://short." + domain
api_endpoint = "https://" + api_domain
# Allow localhost for development
allowed_origins = [api_endpoint, website_url, "http://localhost:5173", "http://localhost:3000"]

ddb = boto3.resource("dynamodb", region_name=aws_region).Table(table_name)
clicks_stats_ddb = boto3.resource("dynamodb", region_name=aws_region).Table(clicks_stats_table_name)

def decimal_to_number(obj):
    """Convert Decimal objects to int or float for JSON serialization"""
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

def cors_setup(event):
    headers = event.get("headers") or {}
    if "origin" in headers:
        logging.info("Origin header detected: %s", headers["origin"])
        origin = headers["origin"]
        if origin in allowed_origins:
            logging.info("Origin %s is allowed", origin)
        else:
            origin = "https://www.accessdenied.com/" # =)
    else:
        origin = "https://www.accessdenied.com/" # =)

    return origin

def generate_timestamp():
    response = strftime("%Y-%m-%dT%H:%M:%S")
    return response


def get_current_week():
    """Returns current week in ISO format: YYYY-WW"""
    now = datetime.now()
    iso_calendar = now.isocalendar()
    return f"{iso_calendar[0]}-W{iso_calendar[1]:02d}"


def track_click(short_id, ttl_value):
    """
    Track a click for a given short_id in the current week
    Uses DynamoDB atomic counter to increment the click count
    """
    week = get_current_week()

    try:
        clicks_stats_ddb.update_item(
            Key={
                "short_id": short_id,
                "week": week
            },
            UpdateExpression="SET clicks = if_not_exists(clicks, :zero) + :inc, #ttl = :ttl",
            ExpressionAttributeNames={
                "#ttl": "ttl"
            },
            ExpressionAttributeValues={
                ":inc": 1,
                ":zero": 0,
                ":ttl": int(ttl_value)
            }
        )
        logging.info("Successfully tracked click for short_id: %s, week: %s", short_id, week)
    except ClientError as error:
        logging.error("Failed to track click for short_id: %s, week: %s, error: %s", short_id, week, error)


def get_stats(short_id):
    """
    Retrieve all weekly statistics for a given short_id
    Returns a list of weeks with their click counts
    """
    try:
        response = clicks_stats_ddb.query(
            KeyConditionExpression="short_id = :sid",
            ExpressionAttributeValues={
                ":sid": short_id
            }
        )

        stats = []
        if "Items" in response:
            for item in response["Items"]:
                stats.append({
                    "week": item.get("week"),
                    "clicks": item.get("clicks", 0)
                })

        # Sort by week (descending - most recent first)
        stats.sort(key=lambda x: x["week"], reverse=True)

        logging.info("Successfully retrieved stats for short_id: %s", short_id)
        return stats

    except ClientError as error:
        logging.error("Failed to retrieve stats for short_id: %s, error: %s", short_id, error)
        return []


def expiry_date(days=7):
    if days is None or days == 0: # Nothing sent
        days = 7
    if days < 0: # Negative value => almost infinite value (ie 100 years)
        days = 36500
        # Note: EPOCH may have an overflow issue for date after Tuesday, January 19, 2038
        #       https://www.epoch101.com/The-2038-Problem
    ttl = days * 3600 * 24
    response = int(time()) + int(ttl)
    return response


def check_id(short_id):
    response = ddb.get_item(Key={"short_id": short_id})
    if "Item" in response:
        print("short_id already exists in Table, generating a new one")
        return False
    else:
        print("newly generate_id is not used, going forward:", short_id)
        return True

def generate_id( human_readble = False ):

    vowels = ['a', 'e', 'i', 'o', 'u', 'y']
    consonants = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'w', 'x',  'z']
    syllabs = math.ceil(randint(min_char, max_char) / 2)
    
    
    unique = False
    while not unique:
        if not human_readble:
            short_id = "".join(
                choice(string_format) for x in range(randint(min_char, max_char))
            )
        else:
            short_id = "".join(
                (choice(consonants)+choice(vowels)) for x in range(syllabs)      
            )
        unique = check_id(short_id)

    return short_id    


def check_shortid_exists(event, context):
    """
    Handler for HEAD /{shortid} endpoint
    Returns 200 if the short ID exists, 404 if not
    This is a public endpoint, so we allow all origins (*)
    """
    # Extract short_id from path
    path = event.get("path", "").strip("/")
    short_id = path

    if not short_id:
        return {
            "statusCode": 400,
            "headers": {
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "HEAD,GET,OPTIONS",
            },
            "body": json.dumps({"message": "Missing short_id"}),
        }

    try:
        response = ddb.get_item(Key={"short_id": short_id})
        if "Item" in response:
            # Short ID exists
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "HEAD,GET,OPTIONS",
                },
                "body": json.dumps({"exists": True}),
            }
        else:
            # Short ID doesn't exist
            return {
                "statusCode": 404,
                "headers": {
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "HEAD,GET,OPTIONS",
                },
                "body": json.dumps({"exists": False}),
            }
    except ClientError as error:
        logging.error("Error checking short_id existence: %s, error: %s", short_id, error)
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "HEAD,GET,OPTIONS",
            },
            "body": json.dumps({"error": "Internal server error"}),
        }


def main(event, context):
    logging.info("===> Event: %s", event)
    if "short_id" in event:
        answer = retreiver(event, context)
        return answer
    else:
        if "/create" in event["path"] and event["httpMethod"] == "POST":
            answer = create(event, context)
        elif "/stats/" in event["path"] and event["httpMethod"] == "GET":
            answer = stats_handler(event, context)
        elif event["httpMethod"] == "HEAD" and event["path"] != "/create" and "/stats/" not in event["path"]:
            # Handle HEAD for /{shortid} endpoint
            answer = check_shortid_exists(event, context)
        else:
            cors = cors_setup(event)
            answer = {
                "statusCode": 403,
                "headers": {
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Origin": cors,
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
                },
                "body": json.dumps({"Error": "Access Denied"}),
            }

    return answer


def create(event, context):
    analytics = {}
    body_data = json.loads(event.get("body"))

    # Handle empty long_url
    if not body_data.get("long_url"):
        cors = cors_setup(event)
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Origin": cors,
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
            },
            "body": json.dumps({"message": "Empty url field"}),
        }
    else:
        # Handle wrong url
        if validators.url(body_data.get("long_url")):
            long_url = body_data.get("long_url")
        else:
            cors = cors_setup(event)
            return {
                "statusCode": 500,
                "headers": {
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Origin": cors,
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
                },
                "body": json.dumps({"message": "Malformed URL"}),
            }

    # Check if user provided a custom_id
    custom_id = body_data.get("custom_id")
    if custom_id:
        # Validate custom_id characters (only a-z, 0-9, -, _)
        if not CUSTOM_ID_REGEX.match(custom_id):
            cors = cors_setup(event)
            return {
                "statusCode": 400,
                "headers": {
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Origin": cors,
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
                },
                "body": json.dumps({
                    "message": "Custom ID can only contain letters, numbers, and single hyphens (-), underscores (_), or periods (.) between alphanumeric characters"
                }),
            }

        # Validate custom_id length
        if len(custom_id) < custom_min_char or len(custom_id) > custom_max_char:
            cors = cors_setup(event)
            return {
                "statusCode": 400,
                "headers": {
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Origin": cors,
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
                },
                "body": json.dumps({
                    "message": f"Custom ID must be between {custom_min_char} and {custom_max_char} characters",
                    "min_length": custom_min_char,
                    "max_length": custom_max_char
                }),
            }

        # Check if custom_id already exists
        if not check_id(custom_id):
            cors = cors_setup(event)
            return {
                "statusCode": 409,
                "headers": {
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Origin": cors,
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
                },
                "body": json.dumps({"message": "Custom ID already exists"}),
            }

        short_id = custom_id
    elif body_data.get("human_readable"):
        short_id = generate_id(True)
    else:
        short_id = generate_id(False)

    short_url = "https://" + api_domain + "/" + short_id



    # Try to read the ttl_in_days value
    try:
        ttl = json.loads(event.get("body")).get("ttl_in_days")
    except:
        ttl = 0

    timestamp = generate_timestamp()
    ttl_value = expiry_date(ttl)

    analytics["user_agent"] = event.get("headers").get("User-Agent")
    analytics["source_ip"] = event.get("headers").get("X-Forwarded-For")
    analytics["xray_trace_id"] = event.get("headers").get("X-Amzn-Trace-Id")
    logging.info("Generating analytics: %s", analytics)

    if len(parse.urlsplit(long_url).query) > 0:
        url_params = dict(parse.parse_qsl(parse.urlsplit(long_url).query))
        for k in url_params:
            analytics[k] = url_params[k]
    else:
        logging.info("No parameter detected in this url: %s", long_url)

    try:
        response = ddb.put_item(
            Item={
                "short_id": short_id,
                "created_at": timestamp,
                "ttl": int(ttl_value),
                "short_url": short_url,
                "long_url": long_url,
                "analytics": analytics,
                "hits": int(0),
            }
        )

        body = {
            "short_id": short_id,
            "created_at": timestamp,
            "ttl": int(ttl_value),
            "short_url": short_url,
            "long_url": long_url,
        }
        cors = cors_setup(event)
        answer = {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Origin": cors,
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
            },
            "body": json.dumps(body),
        }
    except ClientError as e:
        logging.error("Error while writing new short_url to table: %s", e)

    return answer


def stats_handler(event, context):
    """
    Handler for the /stats/{shortid} endpoint
    Returns weekly statistics for a given short link
    """
    cors = cors_setup(event)

    # Extract short_id from path
    path_parts = event["path"].strip("/").split("/")
    if len(path_parts) < 2:
        return {
            "statusCode": 400,
            "headers": {
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Access-Control-Allow-Origin": cors,
                "Access-Control-Allow-Methods": "OPTIONS,GET",
            },
            "body": json.dumps({"error": "Missing short_id"}),
        }

    short_id = path_parts[1]
    logging.info("Stats requested for short_id: %s", short_id)

    # First, verify the short_id exists
    try:
        item = ddb.get_item(Key={"short_id": short_id})
        if "Item" not in item:
            return {
                "statusCode": 404,
                "headers": {
                    "Access-Control-Allow-Headers": "Content-Type,Authorization",
                    "Access-Control-Allow-Origin": cors,
                    "Access-Control-Allow-Methods": "OPTIONS,GET",
                },
                "body": json.dumps({"error": "Short link not found"}),
            }

        # Get the link details
        link_info = item["Item"]

        # Get weekly stats
        weekly_stats = get_stats(short_id)

        # Calculate total clicks from weekly stats
        total_weekly_clicks = sum(stat["clicks"] for stat in weekly_stats)

        response_body = {
            "short_id": short_id,
            "short_url": link_info.get("short_url"),
            "long_url": link_info.get("long_url"),
            "created_at": link_info.get("created_at"),
            "total_hits": link_info.get("hits", 0),
            "weekly_stats": weekly_stats,
            "total_weekly_clicks": total_weekly_clicks
        }

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Access-Control-Allow-Origin": cors,
                "Access-Control-Allow-Methods": "OPTIONS,GET",
            },
            "body": json.dumps(response_body, default=decimal_to_number),
        }

    except ClientError as error:
        logging.error("Error retrieving stats for short_id: %s, error: %s", short_id, error)
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Access-Control-Allow-Origin": cors,
                "Access-Control-Allow-Methods": "OPTIONS,GET",
            },
            "body": json.dumps({"error": "Internal server error"}),
        }


def retreiver(event, context):
    short_id = event.get("short_id")
    logging.info("long-url requested for short_id: %s", short_id)

    try:
        item = ddb.get_item(Key={"short_id": short_id})

        if "Item" in item:
            long_url = item.get("Item").get("long_url")
            ttl_value = item.get("Item").get("ttl", 0)
        else:
            return {
                "statusCode": 301,
                "location": fallback_url,
            }
        logging.info(
            "Successfully retreived long-url: %s requested for short_id: %s",
            long_url,
            short_id,
        )
        # Stats: increase the hit number on the db entry of the url (for analytics)
        try:
            ddb.update_item(
                Key={"short_id": short_id},
                UpdateExpression="set hits = hits + :val",
                ExpressionAttributeValues={":val": 1},
            )
        except ClientError as error:
            logging.error(
                "Failed to increase the stats for: %s with: %s", short_id, error
            )

        # Track weekly clicks with the same TTL as the link
        track_click(short_id, ttl_value)

    except ClientError as err:
        long_url = fallback_url
        logging.error(
            "Can't find this short_id: %s, falling back to default: %s", short_id, err
        )

    answer = {
        "statusCode": 301,
        "location": long_url,
    }

    return answer
