import hashlib
import json
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, Header, HTTPException
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from .catalog import STAGES
from .db import EnquiryRecord, engine, get_session
from .schemas import EnquiryIn, Receipt
from .admin import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(title="BM International School API", version="0.2.0", lifespan=lifespan)
app.include_router(admin_router)
Db = Annotated[AsyncSession, Depends(get_session)]


@app.get("/api/health")
async def health(db: Db):
    try:
        await db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(503, "Local PostgreSQL database is unavailable.")
    return {"status": "ok", "database": "connected"}


@app.get("/api/stages")
async def stages():
    return STAGES


@app.post("/api/enquiries", response_model=Receipt, status_code=202)
async def create_enquiry(payload: EnquiryIn, db: Db, idempotency_key: Annotated[UUID, Header()]):
    request_hash = hashlib.sha256(json.dumps(payload.model_dump(mode="json"), sort_keys=True).encode()).hexdigest()
    try:
        existing = await db.scalar(select(EnquiryRecord).where(EnquiryRecord.idempotency_key == str(idempotency_key)))
        if existing:
            if existing.request_hash != request_hash:
                raise HTTPException(409, "Idempotency key already used for different data.")
            return existing
        record = EnquiryRecord(idempotency_key=str(idempotency_key), request_hash=request_hash, **payload.model_dump(exclude={"consent"}))
        db.add(record)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            existing = await db.scalar(select(EnquiryRecord).where(EnquiryRecord.idempotency_key == str(idempotency_key)))
            if existing is None:
                raise
            if existing.request_hash != request_hash:
                raise HTTPException(409, "Idempotency key already used for different data.")
            return existing
        return record
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(503, "Local admissions database is unavailable. Please retry.")


@app.get("/api/enquiries/{enquiry_id}", response_model=Receipt)
async def get_receipt(enquiry_id: UUID, db: Db):
    try:
        record = await db.get(EnquiryRecord, str(enquiry_id))
    except SQLAlchemyError:
        raise HTTPException(503, "Local admissions database is unavailable.")
    if record is None:
        raise HTTPException(404, "Enquiry not found.")
    # Public receipt exposes no names, contact details, or message content.
    return record
