# core/s3_client.py
from typing import Optional
import boto3
from botocore.config import Config as BotoConfig
from core.config import settings

def get_s3_client():
    if settings.S3_ENDPOINT:
        # MinIO or custom endpoint
        return boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            config=BotoConfig(s3={"addressing_style": "path"}),
            use_ssl=settings.S3_USE_SSL
        )
    else:
        # Default AWS config (credentials from env/instance)
        return boto3.client("s3", region_name=settings.S3_REGION)
