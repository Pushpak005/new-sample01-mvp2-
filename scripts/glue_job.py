# Glue Python-shell job script (reads CSV from S3 and writes to DynamoDB)
# PRE-FILLED for your account/bucket/table:
#   BUCKET: my-temp-glue-bucket-pushpak-20251228
#   S3_KEY default: sample.csv  (change if you uploaded a different key)
#   DDB_TABLE: FoodMenusProdTest
# Region: us-east-1
#
# Notes:
# - This is intended for small sample files (first-run test).
# - It converts numeric-looking fields to Decimal for DynamoDB.
# - It expects a header row in the CSV.
# - Ensure the Glue role you use has the inline policy you added and AWSGlueServiceRole attached.
import os
import csv
import boto3
import logging
from decimal import Decimal

# Pre-filled values (can be overridden by environment variables in Glue job if you prefer)
S3_BUCKET = os.getenv("S3_BUCKET", "my-temp-glue-bucket-pushpak-20251228")
S3_KEY = os.getenv("S3_KEY", "sample.csv")
DDB_TABLE = os.getenv("DDB_TABLE", "FoodMenusProdTest")
REGION = os.getenv("AWS_REGION", "us-east-1")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("glue_job")

s3 = boto3.client("s3", region_name=REGION)
dynamodb = boto3.resource("dynamodb", region_name=REGION)
table = dynamodb.Table(DDB_TABLE)

def to_decimal_if_num(s):
    if s is None:
        return None
    s = s.strip()
    if s == "":
        return None
    # try integer
    try:
        if "." in s:
            return Decimal(str(float(s)))
        return Decimal(int(s))
    except Exception:
        # not numeric — return original string
        return s

def run():
    logger.info("Starting Glue job: download s3://%s/%s", S3_BUCKET, S3_KEY)
    tmp_path = "/tmp/input.csv"
    s3.download_file(S3_BUCKET, S3_KEY, tmp_path)
    logger.info("Downloaded to %s", tmp_path)

    with open(tmp_path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        written = 0
        with table.batch_writer() as batch:
            for row in reader:
                item = {}
                for k, v in row.items():
                    if v is None:
                        continue
                    cv = to_decimal_if_num(v)
                    if cv is None:
                        continue
                    item[k] = cv
                # Ensure primary keys exist — adjust if your CSV has different PK/SK columns
                if "item_id" in row and "pk" not in item:
                    item["pk"] = f"FOOD#{row['item_id']}"
                if "sk" not in item:
                    item["sk"] = "META#1"
                # write
                batch.put_item(Item=item)
                written += 1
        logger.info("Completed. Items written: %d", written)

if __name__ == "__main__":
    try:
        run()
        logger.info("Glue job finished successfully.")
    except Exception as e:
        logger.exception("Glue job failed: %s", e)
        raise
