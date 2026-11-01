"""Download project-local Windows dev services; no system install or deployment."""
import os
from pathlib import Path
import subprocess
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / ".tools"
DATA = ROOT / ".local"
DOWNLOADS = {
    "postgres": ("https://get.enterprisedb.com/postgresql/postgresql-17.7-1-windows-x64-binaries.zip", TOOLS / "postgres.zip", TOOLS / "postgres"),
    "temporal": ("https://github.com/temporalio/cli/releases/download/v1.9.1/temporal_cli_1.9.1_windows_amd64.zip", TOOLS / "temporal.zip", TOOLS / "temporal"),
}


def install(name):
    url, archive, destination = DOWNLOADS[name]
    binary = destination / ("pgsql/bin/pg_ctl.exe" if name == "postgres" else "temporal.exe")
    if binary.exists():
        return
    print(f"Downloading project-local {name}…", flush=True)
    TOOLS.mkdir(exist_ok=True)
    urllib.request.urlretrieve(url, archive)
    with zipfile.ZipFile(archive) as package:
        package.extractall(destination)
    archive.unlink()


def main():
    if sys.platform != "win32":
        raise SystemExit("Use docker compose up --build on this platform, or install native PostgreSQL and Temporal.")
    for name in DOWNLOADS:
        install(name)
    DATA.mkdir(exist_ok=True)
    pg_data = DATA / "postgres"
    if not (pg_data / "PG_VERSION").exists():
        pwfile = DATA / "init-password"
        pwfile.write_text("bm_local", encoding="utf-8")
        try:
            subprocess.run([str(TOOLS / "postgres/pgsql/bin/initdb.exe"), "-D", str(pg_data), "-U", "bm", "--pwfile", str(pwfile), "--auth-host=scram-sha-256", "--auth-local=trust", "--encoding=UTF8", "--locale=C"], check=True)
        finally:
            pwfile.unlink(missing_ok=True)
        with (pg_data / "postgresql.conf").open("a") as config:
            config.write("\nlisten_addresses = '127.0.0.1'\nport = 5432\n")
    print("Local services are ready. Run npm run dev:all.", flush=True)


if __name__ == "__main__":
    main()
