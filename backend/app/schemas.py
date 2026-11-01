from datetime import datetime
from typing import Literal
from uuid import UUID
import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

StageName = Literal["Primary school", "Secondary school", "Not sure yet"]


class EnquiryIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr = Field(max_length=200)
    phone: str = Field(min_length=7, max_length=32)
    # Retained for older clients; new forms only ask for a grade.
    stage: StageName = "Not sure yet"
    grade: int = Field(ge=1, le=11, strict=True)
    message: str = Field(default="", max_length=3000)
    consent: Literal[True]

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        if not re.fullmatch(r"\+?[0-9 ().-]+", value):
            raise ValueError("Enter a valid phone number.")
        digits = re.sub(r"[^0-9]", "", value)
        if not 7 <= len(digits) <= 15:
            raise ValueError("Use 7 to 15 digits.")
        return re.sub(r"[ ().-]", "", value)


class Receipt(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    reference: str
    status: Literal["received", "ready_for_review"]
    created_at: datetime
