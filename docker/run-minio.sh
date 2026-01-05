#!/usr/bin/env bash
set -e

# --- MinIO server ---
docker rm -f dmf-minio-server 2>/dev/null || true

docker run -d \
  --name dmf-minio-server \
  --restart always \
  -p "${MINIO_API_PORT}:9000" \
  -p "${MINIO_CONSOLE_PORT}:9001" \
  -e MINIO_ROOT_USER="${S3_ACCESS_KEY_ID}" \
  -e MINIO_ROOT_PASSWORD="${S3_SECRET_ACCESS_KEY}" \
  -v "${MINIO_DATA_PATH}:/data" \
  minio/minio:latest \
  server /data --console-address ":9001"

sleep 5

# --- MinIO init (mc) ---
docker run --rm \
  --name dmf-minio-init \
  --link dmf-minio-server:minio \
  -e S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}" \
  -e S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
  -e BUCKET_NAME="${BUCKET_NAME}" \
  minio/mc:latest \
  /bin/sh -c "
    mc alias set local http://minio:9000 ${S3_ACCESS_KEY_ID} ${S3_SECRET_ACCESS_KEY} &&
    mc mb -p local/${BUCKET_NAME} || true &&
    mc ilm rule add --expire-days 1 local/${BUCKET_NAME}
  "
