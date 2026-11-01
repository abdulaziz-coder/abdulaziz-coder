"""Reset the local admin password without putting it in shell history."""
from getpass import getpass

from .admin_auth import save_credentials
from .config import settings


if __name__ == "__main__":
    password = getpass("New local admin password (at least 12 characters): ")
    if len(password) < 12:
        raise SystemExit("Use at least 12 characters.")
    if password != getpass("Confirm password: "):
        raise SystemExit("Passwords do not match.")
    save_credentials("admin", password)
    settings.admin_auth_path.with_name("admin-access.txt").unlink(missing_ok=True)
    print("Admin password updated. Previous sessions are invalidated.")
