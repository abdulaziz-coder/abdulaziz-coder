"""Run the complete stack on loopback; stop owned services with Ctrl+C."""
import os
from pathlib import Path
import socket
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / ".local"
PG = ROOT / ".tools/postgres/pgsql/bin"
PYTHON = ROOT / "backend/.venv/Scripts/python.exe"
children = []
logs = []
process_names = {}
owns_pg = False
HIDDEN = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0


def wait_port(port, process=None, name="service", timeout=60):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if process is not None and process.poll() is not None:
            logfile = DATA / f"{name}.log"
            detail = logfile.read_text(encoding="utf-8", errors="replace")[-2000:] if logfile.exists() else ""
            raise RuntimeError(f"{name} stopped during startup.\n{detail}")
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return
        except OSError:
            time.sleep(.3)
    raise RuntimeError(f"{name} did not become ready on port {port}. Check {DATA / (name + '.log')}.")


def launch(name, args, cwd=ROOT):
    print(f"Starting {name}...", flush=True)
    log = (DATA / f"{name}.log").open("w", encoding="utf-8")
    logs.append(log)
    process = subprocess.Popen(args, cwd=cwd, stdout=log, stderr=subprocess.STDOUT, creationflags=HIDDEN)
    children.append(process)
    process_names[process.pid] = name
    return process


def main():
    global owns_pg
    DATA.mkdir(exist_ok=True)
    if not PYTHON.exists() or not (PG / "pg_ctl.exe").exists():
        raise RuntimeError("Follow the setup steps in README.md first.")
    # Refuse to take over an existing website/API; keep user-owned processes untouched.
    for port in [3000, 8000, 7233]:
        with socket.socket() as probe:
            if probe.connect_ex(("127.0.0.1", port)) == 0:
                raise RuntimeError(f"Port {port} is in use. Stop the existing local process first.")
    result = subprocess.run([str(PG / "pg_ctl.exe"), "status", "-D", str(DATA / "postgres")], capture_output=True, creationflags=HIDDEN)
    if result.returncode != 0:
        print("Starting PostgreSQL (recovery can take a moment)...", flush=True)
        subprocess.run([str(PG / "pg_ctl.exe"), "start", "-D", str(DATA / "postgres"), "-l", str(DATA / "postgres.log"), "-w", "-t", "60"], check=True, creationflags=HIDDEN)
        owns_pg = True
    env = dict(os.environ, PGPASSWORD="bm_local")
    exists = subprocess.check_output([str(PG / "psql.exe"), "-h", "127.0.0.1", "-U", "bm", "-d", "postgres", "-tAc", "SELECT 1 FROM pg_database WHERE datname='bm_school'"], env=env, text=True).strip()
    if not exists:
        subprocess.run([str(PG / "createdb.exe"), "-h", "127.0.0.1", "-U", "bm", "bm_school"], env=env, check=True)
    temporal = launch("temporal", [str(ROOT / ".tools/temporal/temporal.exe"), "server", "start-dev", "--ip", "127.0.0.1", "--ui-ip", "127.0.0.1", "--db-filename", str(DATA / "temporal.db")])
    wait_port(7233, temporal, "temporal")
    print("Preparing the admissions database...", flush=True)
    subprocess.run([str(PYTHON), "-m", "app.init_db"], cwd=ROOT / "backend", check=True)
    api = launch("api", [str(PYTHON), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000", "--loop", "app.runtime:loop_factory"], ROOT / "backend")
    wait_port(8000, api, "api")
    launch("worker", [str(PYTHON), "-m", "app.worker"], ROOT / "backend")
    # Execute Vite directly so shutdown owns the actual process rather than an npm wrapper.
    frontend = launch("frontend", ["node", str(ROOT / "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "3000"])
    wait_port(3000, frontend, "frontend")
    print("\nBoborahim Mashrab International School: http://127.0.0.1:3000\nAPI docs: http://127.0.0.1:8000/docs\nTemporal: http://127.0.0.1:8233\nKeep this terminal open. Press Ctrl+C only when you want to stop. Logs: .local/", flush=True)
    while True:
        for child in children:
            if child.poll() is not None:
                raise RuntimeError(f"{process_names[child.pid]} stopped. See .local/{process_names[child.pid]}.log.")
        time.sleep(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopping local services...", flush=True)
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"\nStartup error: {error}", file=sys.stderr, flush=True)
        sys.exit(1)
    finally:
        # A second Ctrl+C must not interrupt database cleanup or trigger a duplicate stop.
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        for child in reversed(children):
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill()
        if owns_pg:
            status = subprocess.run([str(PG / "pg_ctl.exe"), "status", "-D", str(DATA / "postgres")], capture_output=True, creationflags=HIDDEN)
            if status.returncode == 0:
                subprocess.run([str(PG / "pg_ctl.exe"), "stop", "-D", str(DATA / "postgres"), "-m", "fast", "-w", "-t", "60"], check=False, creationflags=HIDDEN)
        for log in logs:
            log.close()
