import os

import asyncio

from anyio import Condition
from dotenv import load_dotenv
from aiobotocore.session import get_session


class S3Worker:
    def __init__(self):
        load_dotenv()

        self._S3_ACCESS_KEY_ID = os.getenv('S3_ACCESS_KEY_ID')
        self._S3_SECRET_ACCESS_KEY = os.getenv('S3_SECRET_ACCESS_KEY')
        self._S3_ENDPOINT_URL = os.getenv('S3_ENDPOINT_URL')

        self._s3_session = get_session()
        self._s3_client = None

        self.bucket = os.getenv('BUCKET_NAME')
        self.max_file_size = os.getenv('MAX_FILES_SIZE')

    async def __aenter__(self):
        self._client = await self._s3_session.create_client(
            "s3",
            region_name="us-east-1",
            aws_access_key_id=self._S3_ACCESS_KEY_ID,
            aws_secret_access_key=self._S3_SECRET_ACCESS_KEY,
            endpoint_url=self._S3_ENDPOINT_URL,
        ).__aenter__()
        return self

    async def __aexit__(self, exc_type, exc, tb):
        await self._client.__aexit__(exc_type, exc, tb)


    async def upload_file(self, key: str, data: bytes):
        await self._client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
        )

    async def generate_upload_post(self, key: str, content_type: str, expires_in: int = 300) -> dict:
        return await self._client.generate_presigned_post(
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

    async def download_file(self, key: str):
        return await self._client.get_object(
            Bucket=self.bucket,
            Key=key,
        )

    async def generate_download_url(self, key: str, filename: str, expires_in: int = 300) -> str:
        return await self._client.generate_presigned_url("get_object",
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
    async with S3Worker() as worker:
        await worker.upload_file("test.txt", b"hello")
        file = await worker.download_file("test.txt")
        file_text = await file["Body"].read()
        print(file_text)

        url = await worker.generate_download_url("test.txt", "hello.txt")
        print(url)
        url = await worker.generate_upload_post("some.jpg", content_type="image/jpeg")
        print(url)
        url = await worker.generate_download_url("some.jpg", "image.jpg")
        print(url)


if __name__ == "__main__":
    asyncio.run(test_run())