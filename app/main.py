import dotenv
import os
import sys
import random
import string

import asyncio
import uvicorn

from datetime import datetime
from fastapi import FastAPI, Response, status, Request
from starlette.middleware.base import BaseHTTPMiddleware
from loguru import logger

from schemas.api_schemas import *
from s3_worker import S3Worker
from redis_worker import RedisWorker

dotenv.load_dotenv()

logger.remove()
logger.add(f"{os.getenv("LOGS_PATH", "./logs")}/dmf-logs.log",
           format="{time:DD-MM-YYYY HH:mm:ss.SSS}; {level}; {message}", level="DEBUG",
           rotation="1 MB", compression="zip")
logger.add(sys.stdout,
           level="DEBUG",
           format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}",)

disable_docs = os.getenv("DISABLE_DOCS", "true").lower() == "true"
app: FastAPI = FastAPI(title="DropMeFiles analog",
                    summary="OpenAPI schema for \"DropMeFiles analog\" project!",
                    version="0.1",
                    contact={"GitHub": "https://github.com/IgorVolochay/Drop-me-files-analog"},
                    docs_url=None if disable_docs else "/docs",
                    redoc_url=None if disable_docs else "/redoc",
                    openapi_url=None if disable_docs else "/openapi.json")

s3_worker = S3Worker()
redis_worker = RedisWorker()

class RealIPMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            request.state.client_ip = forwarded.split(",")[0].strip()
        else:
            request.state.client_ip = request.headers.get("X-Real-IP", request.client.host)

        response = await call_next(request)
        return response
app.add_middleware(RealIPMiddleware)

@logger.catch
@app.get("/upload_token", status_code=200)
async def get_upload_token(file_name: str, file_type: str, file_size: int, response: Response, request: Request) -> BaseResponse:
    user_ip = request.state.client_ip
    logger.debug(f"User IP: {user_ip}; Endpoint: /upload_token; File Name: {file_name}; File Type: {file_type}; File Size: {file_size}")
    if file_size > int(os.getenv('MAX_FILES_SIZE')):
        response.status_code = status.HTTP_413_CONTENT_TOO_LARGE
        logger.warning(f"User IP: {user_ip}; File Name: {file_name}; Exception: The file is too large")
        return BaseResponse(result="The uploaded file is too large", error=True)
    elif file_size <= 0:
        response.status_code = status.HTTP_400_BAD_REQUEST
        logger.warning(f"User IP: {user_ip}; File Name: {file_name}; Exception: The file is less than 1 byte")
        return BaseResponse(result="The file you are uploading is less than 1 byte, WTF?", error=True)

    file_uuid = ''.join(random.choices(string.ascii_letters + string.digits, k=6))
    try:
        post_data = await s3_worker.generate_upload_post(file_uuid, content_type=file_type)
    except Exception as exception:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        logger.error(f"User IP: {user_ip}; File Name: {file_name}; Exception: {exception}")
        return BaseResponse(result="Error generating S3 access token", error=True)

    redis_worker.create_record(user_ip, file_name, file_uuid, file_type, datetime.now().isoformat(), file_size)

    logger.success(f"User IP: {user_ip}; POST data: {post_data}")
    return BaseResponse(result={"data": post_data, "file_uuid": file_uuid, "comment": "Ok"})

@app.get("/max_file_size", status_code=200)
def get_max_file_size() -> int:
    logger.debug("Max file size")
    return int(os.getenv('MAX_FILES_SIZE'))

@logger.catch
@app.get("/get_download_link/{file_uuid}", status_code=200)
async def get_file_by_uuid(file_uuid:str, response: Response, request: Request) -> BaseResponse:
    user_ip = request.state.client_ip
    logger.debug(f"User IP: {user_ip}; Endpoint: /get_download_link/; File UUID: {file_uuid}")
    if len(file_uuid) != 6:
        response.status_code = status.HTTP_404_NOT_FOUND
        logger.warning(f"User IP: {user_ip}; File UUID: {file_uuid}; Exception: Invalid UUID")
        return BaseResponse(result="The file UUID must be 6 characters long",  error=True)
    redis_data = redis_worker.get_record(file_uuid)
    if not redis_data:
        response.status_code = status.HTTP_400_BAD_REQUEST
        logger.warning(f"User IP: {user_ip}; File UUID: {file_uuid}; Exception: File with this UUID not found")
        return BaseResponse(result={"data": None, "comment": "File with this UUID not found"}, error=True)

    try:
        download_url = await s3_worker.generate_download_url(file_uuid, redis_data["file_name"])
    except Exception as exception:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        logger.error(f"User IP: {user_ip}; File UUID: {file_uuid}; Exception: {exception}")
        return BaseResponse(result="Error generating S3 access token", error=True)

    logger.success(f"User IP: {user_ip}; File UUID: {file_uuid}")
    return BaseResponse(result={"data": {"url": download_url, "file_name": redis_data["file_name"], "file_size": redis_data["file_size"]}, "comment": "Ok"})

@app.get("/health_check")
def health_check():
    logger.debug("Health check")
    return True


async def main():
    config = uvicorn.Config("main:app", port=int(os.getenv('BACKEND_PORT')), host="0.0.0.0", log_level="critical")
    server = uvicorn.Server(config)
    await server.serve()

if __name__ == "__main__":
    asyncio.run(main())