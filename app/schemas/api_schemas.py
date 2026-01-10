import typing

from pydantic import BaseModel, Field, HttpUrl, PositiveInt


class BaseResponse(BaseModel):
    result: typing.Any
    error: bool = False

class UploadFields(BaseModel):
    content_type: str = Field(alias="Content-Type")
    acl: str
    key: str
    aws_access_key_id: str = Field(alias="AWSAccessKeyId")
    policy: str
    signature: str


class UploadToken(BaseModel):
    url: HttpUrl
    fields: UploadFields