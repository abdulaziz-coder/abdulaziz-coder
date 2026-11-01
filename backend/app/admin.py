import hashlib
import re
from datetime import datetime
from uuid import UUID
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from .admin_auth import AdminSession, COOKIE, SESSION_SECONDS, authenticate, check_origin, private_response, require_admin, sessions
from .db import EnquiryRecord, get_session
from .schemas import Receipt

router = APIRouter(prefix="/api/admin", tags=["Local admin"], dependencies=[Depends(private_response)])
Db = Annotated[AsyncSession, Depends(get_session)]
Admin = Annotated[AdminSession, Depends(require_admin)]


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=256)


class AdminIdentity(BaseModel):
    username: str


class EnquiryDetail(Receipt):
    status: Literal["new", "received", "ready_for_review"]
    name: str
    email: str
    phone: str | None
    grade: int | None
    message: str
    received_at: datetime | None


def enquiry_detail(record: EnquiryRecord):
    return {
        "id": record.id, "reference": record.reference, "name": record.name, "email": record.email, "phone": record.phone,
        "grade": record.grade, "message": record.message, "created_at": record.created_at,
        "status": "received" if record.staff_received_at else "new" if record.status == "received" else record.status,
        "received_at": record.staff_received_at,
    }


class EnquiryStats(BaseModel):
    total: int
    received: int
    ready_for_review: int


class EnquiryPage(BaseModel):
    items: list[EnquiryDetail]
    total: int
    page: int
    page_size: int
    stats: EnquiryStats


@router.post("/login", response_model=AdminIdentity)
def login(payload: LoginIn, request: Request, response: Response):
    token = authenticate(payload.username, payload.password, request)
    response.set_cookie(COOKIE, token, httponly=True, samesite="strict", secure=False, path="/api/admin", max_age=SESSION_SECONDS)
    return {"username": payload.username}


@router.get("/session", response_model=AdminIdentity)
def session(admin: Admin):
    return {"username": admin.username}


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response):
    check_origin(request)
    token = request.cookies.get(COOKIE, "")
    sessions.pop(hashlib.sha256(token.encode()).hexdigest(), None)
    response.delete_cookie(COOKIE, path="/api/admin", httponly=True, samesite="strict")


@router.get("/enquiries", response_model=EnquiryPage)
async def enquiries(
    admin: Admin, db: Db, q: str = Query(default="", max_length=200),
    grade: int | None = Query(default=None, ge=1, le=11),
    status: Literal["new", "received", "ready_for_review"] | None = None,
    page: int = Query(default=1, ge=1), page_size: int = Query(default=25, ge=1, le=100),
):
    filters = []
    if q.strip():
        search = [EnquiryRecord.name.icontains(q.strip(), autoescape=True), EnquiryRecord.email.icontains(q.strip(), autoescape=True), EnquiryRecord.id.icontains(q.strip(), autoescape=True)]
        match = re.fullmatch(r"(?:BM-)?(\d{1,18})", q.strip(), re.IGNORECASE)
        if match:
            search.append(EnquiryRecord.reference_number == int(match.group(1)))
        phone_query = re.sub(r"[+ ().-]", "", q.strip())
        if phone_query.isascii() and phone_query.isdigit() and len(phone_query) >= 3:
            search.append(EnquiryRecord.phone.contains(phone_query, autoescape=True))
        filters.append(or_(*search))
    if grade is not None:
        filters.append(EnquiryRecord.grade == grade)
    if status == "received":
        filters.append(EnquiryRecord.staff_received_at.is_not(None))
    elif status is not None:
        filters.extend([EnquiryRecord.staff_received_at.is_(None), EnquiryRecord.status == ("received" if status == "new" else status)])
    try:
        total = await db.scalar(select(func.count()).select_from(EnquiryRecord).where(*filters))
        stats = (await db.execute(select(
            func.count(EnquiryRecord.id),
            func.count(EnquiryRecord.id).filter(EnquiryRecord.staff_received_at.is_not(None)),
            func.count(EnquiryRecord.id).filter(EnquiryRecord.status == "ready_for_review", EnquiryRecord.staff_received_at.is_(None)),
        ))).one()
        records = (await db.scalars(select(EnquiryRecord).where(*filters).order_by(EnquiryRecord.created_at.desc(), EnquiryRecord.id.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    except SQLAlchemyError:
        raise HTTPException(503, "Local admissions database is unavailable.")
    return {"items": [enquiry_detail(record) for record in records], "total": total, "page": page, "page_size": page_size, "stats": {"total": stats[0], "received": stats[1], "ready_for_review": stats[2]}}


@router.patch("/enquiries/{enquiry_id}/received", response_model=EnquiryDetail)
async def mark_received(enquiry_id: UUID, request: Request, admin: Admin, db: Db):
    check_origin(request)
    try:
        record = await db.get(EnquiryRecord, str(enquiry_id))
        if record is None:
            raise HTTPException(404, "Enquiry not found.")
        # Atomic and idempotent: repeated clicks retain the original acknowledgement time.
        await db.execute(update(EnquiryRecord).where(EnquiryRecord.id == str(enquiry_id), EnquiryRecord.staff_received_at.is_(None)).values(staff_received_at=func.now()))
        await db.commit()
        await db.refresh(record)
        return enquiry_detail(record)
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(503, "Local admissions database is unavailable.")
