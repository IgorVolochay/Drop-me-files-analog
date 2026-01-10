import os

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
            decode_responses=True,
            socket_timeout=10,
            socket_connect_timeout=10,
            retry_on_timeout=True,
            max_connections=50
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