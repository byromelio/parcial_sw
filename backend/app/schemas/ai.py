from pydantic import BaseModel
from typing import Any


class AiCommandIn(BaseModel):
    text: str


class AiCommandOut(BaseModel):
    reply: str
    actions: list[dict[str, Any]]
