import asyncio
from aiobotocore.session import get_session


AWS_ACCESS_KEY_ID = "some_username"
AWS_SECRET_ACCESS_KEY = "some_password"
ENDPOINT_URL = ""


async def main():
    session = get_session()

    # Создаем S3 клиент
    async with session.create_client(
        "s3",
        region_name="us-east-1",
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        endpoint_url=ENDPOINT_URL,          # важно для MinIO
    ) as s3:

        bucket = "mybucket"
        key = "example.txt"

        # 1. Создаем bucket
        print("Создаю bucket…")
        await s3.create_bucket(Bucket=bucket)

        # 2. Загружаем файл (put_object)
        print("Загружаю файл…")
        await s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=b"Hello from aiobotocore + MinIO!"
        )

        # 3. Скачиваем файл
        print("Скачиваю файл…")
        obj = await s3.get_object(Bucket=bucket, Key=key)
        data = await obj["Body"].read()
        print("Содержимое:", data.decode())


asyncio.run(main())
