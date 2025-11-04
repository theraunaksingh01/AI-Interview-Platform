# scripts/set_cors.py
import os, sys, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from core.s3_client import get_s3_client
from core.config import settings

# boto3 expects a dict keyed by "CORSConfiguration" with "CORSRules" inside
cors_payload = {
    "CORSConfiguration": {
        "CORSRules": [
            {
                "AllowedOrigins": ["http://localhost:3000"],
                "AllowedMethods": ["PUT", "GET", "POST"],
                "AllowedHeaders": ["*"],
                "ExposeHeaders": [],
                "MaxAgeSeconds": 3000
            }
        ]
    }
}

def main():
    s3 = get_s3_client()
    bucket = settings.S3_BUCKET
    if not bucket:
        print("ERROR: S3_BUCKET not configured in settings/.env")
        return
    try:
        s3.put_bucket_cors(Bucket=bucket, CORSConfiguration=cors_payload["CORSConfiguration"])
        print("CORS set successfully.")
    except Exception as e:
        print("Set CORS failed:", repr(e))

if __name__ == "__main__":
    main()
