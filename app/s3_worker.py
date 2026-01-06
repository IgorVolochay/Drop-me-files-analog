import os

import asyncio
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from aiobotocore.session import get_session


class S3Worker:
    def __init__(self):
        load_dotenv()

        self._s3_config = {
            "aws_access_key_id": os.getenv('S3_ACCESS_KEY_ID'),
            "aws_secret_access_key": os.getenv('S3_SECRET_ACCESS_KEY'),
            "endpoint_url": os.getenv('S3_ENDPOINT_URL')
        }

        self._s3_session = get_session()

        self.bucket = os.getenv('BUCKET_NAME')
        self.max_file_size = os.getenv('MAX_FILES_SIZE')

    @asynccontextmanager
    async def get_client(self):
        async with self._s3_session.create_client("s3", **self._s3_config) as client:
            yield client

    async def generate_upload_post(self, key: str, content_type: str, expires_in: int = 300) -> dict:
        async with self.get_client() as client:
            return await client.generate_presigned_post(
                Bucket=self.bucket,
                Key=key,
                Fields={
                    "Content-Type": content_type,
                    "acl": "private",
                },
                Conditions=[
                    ["content-length-range", 0, self.max_file_size],
                    {"acl": "private"},
                ],
                ExpiresIn=expires_in,
            )


    async def generate_download_url(self, key: str, filename: str, expires_in: int = 300) -> str:
        async with self.get_client() as client:
            return await client.generate_presigned_url("get_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": key,
                    "ResponseContentDisposition": (
                        f'attachment; filename="{filename}"'
                    ),
                },
                ExpiresIn=expires_in,
            )


async def test_run():
    worker = S3Worker()

    url = await worker.generate_download_url("test.txt", "hello.txt")
    print(url)
    url = await worker.generate_upload_post("some.jpg", content_type="image/jpeg")
    print(url)
    url = await worker.generate_download_url("some.jpg", "image.jpg")
    print(url)


if __name__ == "__main__":
    asyncio.run(test_run())