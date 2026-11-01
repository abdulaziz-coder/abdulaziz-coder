"""Local admin credentials and short-lived, server-side sessions."""
from collections import defaultdict, deque
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import secrets
import time

from fastapi import Depends, HTTPException, Request, Response

from .config import settings

COOKIE = "bm_admin_session"
SESSION_SECONDS = 8 * 60 * 60


@dataclass
class AdminSession:
    username: str
    expires: float
    credential_hash: str


sessions: dict[str, AdminSession] = {}
attempts: dict[str, deque] = defaultdict(deque)


def hash_password(password: str, salt: bytes) -> str:
    return hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, dklen=32).hex()


def save_credentials(username: str, password: str, path: Path | None = None):
    path = path or settings.admin_auth_path
    path.parent.mkdir(parents=True, exist_ok=True)
    salt = secrets.token_bytes(32)
    contents = {"username": username, "salt": salt.hex(), "password_hash": hash_password(password, salt)}
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(contents), encoding="utf-8")
    temporary.replace(path)


def ensure_admin_account():
    path = settings.admin_auth_path
    if path.exists():
        return
    password = secrets.token_urlsafe(18)
    save_credentials("admin", password)
    access = path.with_name("admin-access.txt")
    access.write_text(f"Local admissions admin\n\nWebsite: http://127.0.0.1:3000/admin\nUsername: admin\nPassword: {password}\n\nKeep this file private. Reset with: python -m app.admin_account\n", encoding="utf-8")
    print(f"Local admin account created. Sign-in details: {access}")


def load_credentials():
    try:
        return json.loads(settings.admin_auth_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise HTTPException(503, "Admin account is not configured. Run the local database initializer.")


def check_origin(request: Request):
    origin = request.headers.get("origin")
    if origin and origin not in settings.admin_allowed_origins:
        raise HTTPException(403, "Origin not allowed.")


def private_response(response: Response):
    response.headers["Cache-Control"] = "no-store"


def authenticate(username: str, password: str, request: Request) -> str:
    check_origin(request)
    ip = request.client.host if request.client else "local"
    now = time.monotonic()
    recent = attempts[ip]
    while recent and recent[0] <= now - 60:
        recent.popleft()
    if len(recent) >= 5:
        raise HTTPException(429, "Too many sign-in attempts. Try again in a minute.")
    recent.append(now)
    credentials = load_credentials()
    digest = hash_password(password, bytes.fromhex(credentials["salt"]))
    correct_password = secrets.compare_digest(digest, credentials["password_hash"])
    correct_user = secrets.compare_digest(username.encode(), credentials["username"].encode())
    if not (correct_password and correct_user):
        raise HTTPException(401, "Incorrect username or password.")
    recent.clear()
    for key, session in list(sessions.items()):
        if session.expires <= time.time():
            sessions.pop(key, None)
    if len(sessions) >= 100:
        sessions.pop(next(iter(sessions)))
    token = secrets.token_urlsafe(32)
    sessions[hashlib.sha256(token.encode()).hexdigest()] = AdminSession(credentials["username"], time.time() + SESSION_SECONDS, credentials["password_hash"])
    return token


def require_admin(request: Request) -> AdminSession:
    token = request.cookies.get(COOKIE, "")
    key = hashlib.sha256(token.encode()).hexdigest()
    session = sessions.get(key)
    if session is None or session.expires <= time.time():
        sessions.pop(key, None)
        raise HTTPException(401, "Admin sign-in required.")
    if not secrets.compare_digest(session.credential_hash, load_credentials()["password_hash"]):
        sessions.pop(key, None)
        raise HTTPException(401, "Admin sign-in required.")
    return session
