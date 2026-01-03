import dotenv
import os
import random
import string

import asyncio
import uvicorn

from datetime import datetime
from fastapi import FastAPI, Response, status, Request

from schemas.api_schemas import *
from s3_worker import S3Worker
from redis_worker import RedisWorker

dotenv.load_dotenv()
disable_docs = os.getenv("DISABLE_DOCS", "true").lower() == "true"
app: FastAPI = FastAPI(title="DropMeFiles analog")
# app: FastAPI = FastAPI(title="DropMeFiles analog",
#                     summary="OpenAPI schema for \"DropMeFiles analog\" project!",
#                     version="0.1",
#                     contact={"GitHub": "https://github.com/IgorVolochay/Drop-me-files-analog"},
#                     docs_url=None if disable_docs else "/docs",
#                     redoc_url=None if disable_docs else "/redoc",
#                     openapi_url=None if disable_docs else "/openapi.json")
s3_worker = S3Worker()
redis_worker = RedisWorker()


@app.get("/upload_token", status_code=200)
async def get_upload_token(file_name: str, file_type: str, file_size: int, response: Response, request: Request) -> UploadToken | BaseResponse:
    if file_size > int(os.getenv('MAX_FILES_SIZE')):
        response.status_code = status.HTTP_413_CONTENT_TOO_LARGE
        return BaseResponse(result="The uploaded file is too large", error=True)
    elif file_size <= 0:
        response.status_code = status.HTTP_400_BAD_REQUEST
        return BaseResponse(result="The file you are uploading is less than 1 byte, WTF?", error=True)

    user_ip = request.client.host
    file_uuid = ''.join(random.choices(string.ascii_letters + string.digits, k=6))
    async with s3_worker as worker:
        try:
            post_data = await worker.generate_upload_post(file_name, content_type=file_type)
        except Exception as exception:
            response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
            return BaseResponse(result="Error generating S3 access token. Error: " + str(exception), error=True)

    redis_worker.create_record(user_ip, file_name, file_uuid, file_type, datetime.now().isoformat(), file_size)
    print(post_data)
    return UploadToken.model_validate(post_data)

async def main():
    config = uvicorn.Config("main:app", port=5000, host="0.0.0.0", log_level="debug")
    server = uvicorn.Server(config)
    await server.serve()

if __name__ == "__main__":
    asyncio.run(main())