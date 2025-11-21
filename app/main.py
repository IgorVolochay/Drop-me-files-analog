from fastapi import FastAPI, File, UploadFile
from fastapi.staticfiles import StaticFiles

import dotenv
import os

import asyncio
import uvicorn

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

# app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

@app.post("/upload_file")
async def create_upload_file(file: UploadFile = File(...)):
    return {"filename": file.filename, "content_type": file.content_type}

async def main():
    config = uvicorn.Config("main:app", port=5000, host="0.0.0.0", log_level="debug")
    server = uvicorn.Server(config)
    await server.serve()

if __name__ == "__main__":
    asyncio.run(main())