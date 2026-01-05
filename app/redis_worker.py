import os
from datetime import datetime

import redis
from dotenv import load_dotenv


class RedisWorker:
    def __init__(self):
        load_dotenv()
        self.client = redis.Redis(
            host=os.getenv('REDIS_ADDRESS'),
            port=int(os.getenv('REDIS_PORT')),
            username=os.getenv('REDIS_USERNAME'),
            password=os.getenv('REDIS_PASSWORD'),
            decode_responses=True
        )
        self.files_ttl = int(os.getenv('FILES_TTL'))

    def create_record(self, user_ip: str, file_name: str, file_uuid: str, file_type: str, add_date:str, file_size:int):
        self.client.hset(file_uuid, mapping={
            "file_name": file_name,
            "file_size": file_size,
            "user_ip": user_ip,
            "file_type": file_type,
            "add_date": add_date
        })
        self.client.expire(file_uuid, self.files_ttl)


    def get_record(self, file_uuid:str):
        return self.client.hgetall(file_uuid)


if __name__ == "__main__":
    worker = RedisWorker()
    worker.create_record("127.0.0.1", "some.jpg", "QWERTY", "image/jpeg", datetime.now().isoformat(), file_size=1024)
    print(worker.get_record("QWERTY"))
