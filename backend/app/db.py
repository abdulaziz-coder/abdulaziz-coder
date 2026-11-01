from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, Identity, Integer, String, Text, UniqueConstraint
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from .config import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True, connect_args={"connect_timeout": 3})
Session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class EnquiryRecord(Base):
    __tablename__ = "enquiries"
    __table_args__ = (CheckConstraint("grade BETWEEN 1 AND 11", name="ck_enquiries_grade"), UniqueConstraint("reference_number", name="uq_enquiries_reference_number"))
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    reference_number: Mapped[int] = mapped_column(BigInteger, Identity())
    idempotency_key: Mapped[str] = mapped_column(String(36), unique=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    stage: Mapped[str] = mapped_column(String(40))
    # Older enquiries have no grade recorded; all new API requests require one.
    grade: Mapped[int | None] = mapped_column(Integer, nullable=True)
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="received")
    staff_received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispatched: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    @property
    def reference(self) -> str:
        return f"BM-{self.reference_number:06d}"


async def get_session():
    async with Session() as session:
        yield session
