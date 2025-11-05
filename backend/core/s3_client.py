import os
import boto3
from functools import lru_cache


@lru_cache()
def get_s3_client():
    """
    Lazy loader — allows test suite to monkeypatch/replace the client
    BEFORE first use.
    """
    endpoint = os.getenv("S3_ENDPOINT")  # allows MinIO / fake client
    region = os.getenv("S3_REGION", "us-east-1")

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
    )
