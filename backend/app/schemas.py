from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

StageName = Literal["Primary school", "Secondary school", "Not sure yet"]


class EnquiryIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr = Field(max_length=200)
    # Retained for older clients; new forms only ask for a grade.
    stage: StageName = "Not sure yet"
    grade: int = Field(ge=1, le=11, strict=True)
    message: str = Field(default="", max_length=3000)
    consent: Literal[True]


class Receipt(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    status: Literal["received", "ready_for_review"]
    created_at: datetime
