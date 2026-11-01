import asyncio
import time
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest

from app.admin_auth import COOKIE, attempts, save_credentials, sessions
from app.config import settings
from app.main import app
from app.runtime import loop_factory
from app.db import EnquiryRecord
from test_api import database_client, PAYLOAD

PASSWORD = "Test-only-admin-password"
ORIGIN = {"Origin": "http://127.0.0.1:3000"}


@pytest.fixture(autouse=True)
def local_account(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "admin_auth_path", tmp_path / "admin-auth.json")
    save_credentials("admin", PASSWORD)
    sessions.clear()
    attempts.clear()
    yield
    sessions.clear()
    attempts.clear()


def login(client):
    return client.post("/api/admin/login", json={"username": "admin", "password": PASSWORD}, headers=ORIGIN)


def test_private_endpoints_require_sign_in():
    with TestClient(app, backend_options={"loop_factory": loop_factory}) as client:
        assert client.get("/api/admin/session").status_code == 401
        assert client.get("/api/admin/enquiries").status_code == 401


def test_login_cookie_logout_and_expiry():
    with TestClient(app, backend_options={"loop_factory": loop_factory}) as client:
        assert client.post("/api/admin/login", json={"username": "admin", "password": "wrong"}, headers=ORIGIN).status_code == 401
        response = login(client)
        assert response.status_code == 200
        assert response.json() == {"username": "admin"}
        assert response.headers["cache-control"] == "no-store"
        cookie = response.headers["set-cookie"].lower()
        assert "httponly" in cookie and "samesite=strict" in cookie and "path=/api/admin" in cookie
        assert client.get("/api/admin/session").status_code == 200
        assert client.post("/api/admin/logout", headers=ORIGIN).status_code == 204
        assert client.get("/api/admin/session").status_code == 401
        login(client)
        for session in sessions.values():
            session.expires = time.time() - 1
        assert client.get("/api/admin/session").status_code == 401


def test_origin_check_rate_limit_and_password_reset():
    with TestClient(app, backend_options={"loop_factory": loop_factory}) as client:
        assert client.post("/api/admin/login", json={"username": "admin", "password": PASSWORD}, headers={"Origin": "https://unrelated.example"}).status_code == 403
        for _ in range(5):
            assert client.post("/api/admin/login", json={"username": "admin", "password": "wrong"}, headers=ORIGIN).status_code == 401
        assert login(client).status_code == 429
        attempts.clear()
        assert login(client).status_code == 200
        save_credentials("admin", "A different test password")
        assert client.get("/api/admin/session").status_code == 401


def test_private_search_filters_pagination_and_detail_fields(database_client):
    # The database fixture uses its own schema; no real enquiries are read or changed.
    client = database_client
    for index in range(3):
        response = client.post("/api/enquiries", json={**PAYLOAD, "name": f"Test Family {index}", "grade": 1 if index < 2 else 11}, headers={"Idempotency-Key": str(uuid4())})
        assert response.status_code == 202
    assert login(client).status_code == 200
    response = client.get("/api/admin/enquiries", params={"grade": 1, "page_size": 1})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    data = response.json()
    assert data["total"] == 2 and len(data["items"]) == 1
    assert data["stats"] == {"total": 3, "received": 0, "ready_for_review": 0}
    first = data["items"][0]
    assert first["grade"] == 1 and first["email"] == PAYLOAD["email"] and first["message"] == PAYLOAD["message"]
    assert first["phone"] == "+998901234567"
    assert client.get("/api/admin/enquiries", params={"q": "+998 90 123 45 67"}).json()["total"] == 3
    assert first["reference"].startswith("BM-") and len(first["reference"]) == 9
    assert client.get("/api/admin/enquiries", params={"q": first["reference"]}).json()["items"][0]["id"] == first["id"]
    assert "request_hash" not in first and "idempotency_key" not in first
    second = client.get("/api/admin/enquiries", params={"grade": 1, "page_size": 1, "page": 2}).json()
    assert second["items"][0]["id"] != first["id"]
    assert client.get("/api/admin/enquiries", params={"q": "Family 2"}).json()["total"] == 1
    assert client.get("/api/admin/enquiries", params={"q": "%"}).json()["total"] == 0
    assert client.get("/api/admin/enquiries", params={"status": "ready_for_review"}).json()["total"] == 0
    assert client.get("/api/admin/enquiries", params={"grade": 12}).status_code == 422
    # The public receipt remains private even while an admin is signed in.
    assert set(client.get(f"/api/enquiries/{first['id']}").json()) == {"id", "reference", "status", "created_at"}


def test_received_action_is_protected_idempotent_and_survives_workflow_updates(database_client):
    client = database_client
    created = client.post("/api/enquiries", json=PAYLOAD, headers={"Idempotency-Key": str(uuid4())}).json()
    url = f"/api/admin/enquiries/{created['id']}/received"
    assert client.patch(url, headers=ORIGIN).status_code == 401
    login(client)
    assert client.patch(url, headers={"Origin": "https://unrelated.example"}).status_code == 403
    marked = client.patch(url, headers=ORIGIN)
    assert marked.status_code == 200
    assert marked.json()["status"] == "received"
    assert marked.json()["reference"] == created["reference"]
    timestamp = marked.json()["received_at"]
    assert timestamp is not None
    assert client.patch(url, headers=ORIGIN).json()["received_at"] == timestamp

    async def finish_workflow():
        async with client.enquiry_sessions() as session:
            record = await session.get(EnquiryRecord, created["id"])
            record.status = "ready_for_review"
            await session.commit()

    asyncio.run(finish_workflow(), loop_factory=loop_factory)
    data = client.get("/api/admin/enquiries", params={"status": "received"}).json()
    assert data["total"] == 1 and data["stats"]["received"] == 1 and data["stats"]["ready_for_review"] == 0
    assert data["items"][0]["received_at"] == timestamp
    assert client.get("/api/admin/enquiries", params={"status": "ready_for_review"}).json()["total"] == 0
    assert client.patch(f"/api/admin/enquiries/{uuid4()}/received", headers=ORIGIN).status_code == 404
