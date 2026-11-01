import asyncio
import os
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.db import Base, EnquiryRecord, get_session
from app.main import app
from app.runtime import loop_factory

PAYLOAD = {"name": "Alex Parent", "email": "parent@example.com", "phone": "+998 90 123 45 67", "grade": 1, "message": "Can we visit?", "consent": True}


def test_catalog_without_database():
    with TestClient(app, backend_options={"loop_factory": loop_factory}) as client:
        response = client.get("/api/stages")
        assert response.status_code == 200
        assert [stage["name"] for stage in response.json()] == ["Primary school", "Secondary school"]


@pytest.mark.parametrize("patch", [{"email": "bad"}, {"consent": False}, {"stage": "invalid"}, {"stage": "Early years"}, {"name": " "}, {"message": "a" * 3001}, {"grade": 0}, {"grade": 12}, {"grade": 1.5}, {"grade": None}, {"grade": "5"}])
def test_invalid_enquiries_rejected_before_database(patch):
    with TestClient(app, backend_options={"loop_factory": loop_factory}) as client:
        response = client.post("/api/enquiries", json={**PAYLOAD, **patch}, headers={"Idempotency-Key": str(uuid4())})
        assert response.status_code == 422


@pytest.mark.parametrize("phone", ["", "12345", "+1234567890123456", "call me", "++998901234567", None])
def test_invalid_phone_rejected(phone):
    with TestClient(app, backend_options={"loop_factory": loop_factory}) as client:
        response = client.post("/api/enquiries", json={**PAYLOAD, "phone": phone}, headers={"Idempotency-Key": str(uuid4())})
        assert response.status_code == 422


@pytest.fixture
def database_client():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to run PostgreSQL integration tests")
    schema = "test_" + uuid4().hex
    raw_engine = create_async_engine(url, poolclass=NullPool)
    engine = raw_engine.execution_options(schema_translate_map={None: schema})

    async def setup():
        async with raw_engine.begin() as connection:
            await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    asyncio.run(setup(), loop_factory=loop_factory)
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def override():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_session] = override
    try:
        with TestClient(app, backend_options={"loop_factory": loop_factory}) as client:
            client.enquiry_sessions = sessions
            yield client
    finally:
        app.dependency_overrides.clear()

        async def cleanup():
            async with raw_engine.begin() as connection:
                await connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            await raw_engine.dispose()
        asyncio.run(cleanup(), loop_factory=loop_factory)


def test_save_retry_conflict_and_private_receipt(database_client):
    headers = {"Idempotency-Key": str(uuid4())}
    first = database_client.post("/api/enquiries", json=PAYLOAD, headers=headers)
    assert first.status_code == 202
    assert first.json()["status"] == "received"
    assert first.json()["reference"].startswith("BM-")

    async def saved_contact():
        async with database_client.enquiry_sessions() as session:
            record = await session.get(EnquiryRecord, first.json()["id"])
            return record.grade, record.phone

    assert asyncio.run(saved_contact(), loop_factory=loop_factory) == (1, "+998901234567")
    second = database_client.post("/api/enquiries", json=PAYLOAD, headers=headers)
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["reference"] == first.json()["reference"]
    conflict = database_client.post("/api/enquiries", json={**PAYLOAD, "name": "Someone Else"}, headers=headers)
    assert conflict.status_code == 409
    receipt = database_client.get("/api/enquiries/" + first.json()["id"])
    assert receipt.status_code == 200
    assert set(receipt.json()) == {"id", "reference", "status", "created_at"}
    assert database_client.get("/api/enquiries/" + str(uuid4())).status_code == 404
    assert database_client.post("/api/enquiries", json={**PAYLOAD, "grade": 11}, headers={"Idempotency-Key": str(uuid4())}).status_code == 202
