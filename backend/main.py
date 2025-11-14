from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from typing import Annotated

import dotenv
import os

import asyncio
import uvicorn


dotenv.load_dotenv()
disable_docs = os.getenv("DISABLE_DOCS", "true").lower() == "true"
app: FastAPI = FastAPI(title="This OR That",
                    summary="OpenAPI schema for \"This OR That\" project!",
                    version="0.1",
                    contact={"GitHub": "https://github.com/IgorVolochay/thisORthat"},
                    docs_url=None if disable_docs else "/docs",
                    redoc_url=None if disable_docs else "/redoc",
                    openapi_url=None if disable_docs else "/openapi.json")


origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return "Hello!"

@app.post("/upload_file")
@app.post("/upload_file")
async def create_file(file: Annotated[bytes, File()]):
    return {"file_size": len(file)}

async def main():
    config = uvicorn.Config("main:app", port=5000, log_level="debug")
    server = uvicorn.Server(config)
    await server.serve()

if __name__ == "__main__":
    asyncio.run(main())