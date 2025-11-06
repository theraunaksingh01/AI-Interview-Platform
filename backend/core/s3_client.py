import os
import boto3
from functools import lru_cache
from botocore.client import Config
from core.config import settings

@lru_cache()
def get_s3_client():
    """
    MinIO/S3 client with explicit credentials and path-style addressing.
    """
    endpoint = settings.s3_endpoint  # e.g. http://127.0.0.1:9000
    region   = settings.s3_region or "us-east-1"
    access   = settings.s3_access_key
    secret   = settings.s3_secret_key

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=access,
        aws_secret_access_key=secret,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"}  # MinIO-friendly
        ),
    )
