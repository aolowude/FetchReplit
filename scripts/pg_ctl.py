#!/usr/bin/env python3
"""
Local Postgres launcher for the Fetch dev environment.

Uses the `pgserver` pip package, which ships a portable Postgres binary and
runs it as a subprocess bound to localhost. We create a dedicated data
directory under .run/pgdata so each clone gets its own clean cluster, and
we log to .run/logs/postgres.log.

Usage (called by scripts/app.sh):
    python3 scripts/pg_ctl.py start
    python3 scripts/pg_ctl.py stop
    python3 scripts/pg_ctl.py status
    python3 scripts/pg_ctl.py url
    python3 scripts/pg_ctl.py wait    # block until ready, or fail

Environment overrides:
    PG_PORT       (default 5432)
    PG_USER       (default fetch)
    PG_PASSWORD   (default fetch)
    PG_DATABASE   (default fetch)
"""
from __future__ import annotations

import argparse
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RUN_DIR = REPO_ROOT / ".run"
VENV_DIR = REPO_ROOT / ".venv"
PGDATA = RUN_DIR / "pgdata"
PG_LOG = RUN_DIR / "logs" / "postgres.log"
PG_PID = RUN_DIR / "pg.pid"
PG_PORT = int(os.environ.get("PG_PORT", "5432"))
PG_USER = os.environ.get("PG_USER", "fetch")
PG_PASSWORD = os.environ.get("PG_PASSWORD", "fetch")
PG_DATABASE = os.environ.get("PG_DATABASE", "fetch")
READY_TIMEOUT = int(os.environ.get("PG_READY_TIMEOUT", "45"))


def venv_python() -> str:
    """Return the path to the venv's python binary."""
    if os.name == "nt":
        return str(VENV_DIR / "Scripts" / "python.exe")
    return str(VENV_DIR / "bin" / "python")


def venv_pip() -> list[str]:
    return [venv_python(), "-m", "pip"]


def ensure_venv() -> None:
    """Create the venv and install pgserver + psycopg if missing.

    Re-execs the current process under the venv's Python once the venv is
    ready. That way all subsequent imports (psycopg, pgserver) resolve
    inside the venv, even when this script was originally launched with
    the system Python.
    """
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    (RUN_DIR / "logs").mkdir(parents=True, exist_ok=True)

    if not VENV_DIR.exists():
        print(f"[pg] creating venv at {VENV_DIR} …", flush=True)
        subprocess.run(
            [sys.executable, "-m", "venv", str(VENV_DIR)],
            check=True,
        )

    # If we're not already running under the venv, re-exec now.
    if Path(sys.executable).resolve() != Path(venv_python()).resolve():
        print("[pg] re-launching under venv Python …", flush=True)
        os.execv(venv_python(), [venv_python(), __file__, *sys.argv[1:]])
        # execv does not return on success.

    # Check installed packages.
    try:
        out = subprocess.run(
            [*venv_pip(), "show", "pgserver"],
            capture_output=True, text=True, check=False,
        )
        have_pgserver = out.returncode == 0
    except Exception:
        have_pgserver = False

    try:
        out = subprocess.run(
            [*venv_pip(), "show", "psycopg"],
            capture_output=True, text=True, check=False,
        )
        have_psycopg = out.returncode == 0
    except Exception:
        have_psycopg = False

    if not (have_pgserver and have_psycopg):
        print("[pg] installing pgserver + psycopg[binary] into venv …", flush=True)
        subprocess.run(
            [*venv_pip(), "install", "--quiet", "pgserver", "psycopg[binary]"],
            check=True,
        )


def port_in_use(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        try:
            s.connect((host, port))
            return True
        except OSError:
            return False


def read_pid() -> int | None:
    if not PG_PID.exists():
        return None
    try:
        pid = int(PG_PID.read_text().strip())
    except ValueError:
        return None
    try:
        os.kill(pid, 0)
        return pid
    except OSError:
        return None


def write_pid(pid: int) -> None:
    PG_PID.write_text(str(pid))


def wait_ready() -> bool:
    """Block until Postgres accepts a connection (up to READY_TIMEOUT s)."""
    import psycopg  # type: ignore

    deadline = time.time() + READY_TIMEOUT
    last_err: Exception | None = None
    while time.time() < deadline:
        try:
            conn = psycopg.connect(
                host="127.0.0.1",
                port=PG_PORT,
                user=PG_USER,
                password=PG_PASSWORD,
                dbname=PG_DATABASE,
                connect_timeout=2,
            )
            conn.close()
            return True
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(0.5)
    print(f"[pg] not ready after {READY_TIMEOUT}s: {last_err}", file=sys.stderr)
    return False


def cmd_start() -> int:
    if read_pid() is not None:
        print(f"[pg] already running (pid {PG_PID.read_text().strip()})", flush=True)
        return 0

    if port_in_use("127.0.0.1", PG_PORT):
        print(
            f"[pg] port {PG_PORT} is already in use by another process.\n"
            f"     Either stop that process, or set PG_PORT in .env to a free port.",
            file=sys.stderr,
        )
        return 1

    ensure_venv()

    # Run pgserver in a child Python so it survives the parent (this script
    # returning). We use Popen detached to its own process group.
    PG_LOG.parent.mkdir(parents=True, exist_ok=True)

    # pgserver expects: data_dir, port, user, password, database, ...
    # It will initdb on first run.
    code = f"""
import os
from pgserver import PostgresServer
from pathlib import Path
import sys, signal

# Forward SIGTERM to the server.
def _term(signum, frame):
    try:
        server.stop()
    except Exception:
        pass
    sys.exit(0)
signal.signal(signal.SIGTERM, _term)

data_dir = Path({str(PGDATA)!r})
log_path = Path({str(PG_LOG)!r})

server = PostgresServer(
    data_dir=data_dir,
    port={PG_PORT},
    user={PG_USER!r},
    password={PG_PASSWORD!r},
    database={PG_DATABASE!r},
    cleanup_mode=None,
)
# Initialise (no-op if already initialised) and start.
if not (data_dir / "PG_VERSION").exists():
    server.initdb()
server.start(logger=None)

# Tee server stdout/stderr to the log file.
import threading
def _tee(stream, path):
    with open(path, "a", buffering=1) as f:
        for line in iter(stream.readline, b""):
            try:
                f.write(line.decode("utf-8", errors="replace"))
            except Exception:
                pass
            f.flush()
# pgserver exposes the underlying subprocess as ._process in recent versions;
# if that doesn't exist we just keep this process alive with a sleep.
proc = getattr(server, "_process", None) or getattr(server, "process", None)
if proc and proc.stdout:
    threading.Thread(target=_tee, args=(proc.stdout, log_path), daemon=True).start()
    if proc.stderr:
        threading.Thread(target=_tee, args=(proc.stderr, log_path), daemon=True).start()

# Block until shutdown.
server.wait()
"""
    log = open(PG_LOG, "ab", buffering=0)
    proc = subprocess.Popen(
        [venv_python(), "-c", code],
        stdout=log, stderr=log,
        stdin=subprocess.DEVNULL,
        start_new_session=True,  # own process group
    )
    write_pid(proc.pid)
    print(f"[pg] launching (pid {proc.pid}, port {PG_PORT}) …", flush=True)

    if not wait_ready():
        print("[pg] failed to become ready; tearing down", file=sys.stderr)
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except OSError:
            pass
        return 1

    print(f"[pg] ready on 127.0.0.1:{PG_PORT}", flush=True)
    return 0


def cmd_stop() -> int:
    pid = read_pid()
    if pid is None:
        print("[pg] not running", flush=True)
        # Best-effort cleanup of stale state.
        if PG_PID.exists():
            PG_PID.unlink()
        return 0

    print(f"[pg] stopping (pid {pid}) …", flush=True)
    try:
        os.killpg(pid, signal.SIGTERM)
    except OSError:
        pass

    # Wait up to 10s for graceful exit.
    for _ in range(20):
        try:
            os.kill(pid, 0)
        except OSError:
            break
        time.sleep(0.5)
    else:
        try:
            os.killpg(pid, signal.SIGKILL)
        except OSError:
            pass

    if PG_PID.exists():
        PG_PID.unlink()
    print("[pg] stopped", flush=True)
    return 0


def cmd_status() -> int:
    pid = read_pid()
    if pid is None:
        print("stopped")
        return 1
    print(f"running (pid {pid}, port {PG_PORT})")
    return 0


def cmd_url() -> int:
    print(
        f"postgresql://{PG_USER}:{PG_PASSWORD}@127.0.0.1:{PG_PORT}/{PG_DATABASE}"
    )
    return 0


def cmd_wait() -> int:
    if read_pid() is None:
        print("[pg] not running", file=sys.stderr)
        return 1
    return 0 if wait_ready() else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    for name in ("start", "stop", "status", "url", "wait"):
        sub.add_parser(name)
    args = parser.parse_args()

    if args.cmd == "start":
        return cmd_start()
    if args.cmd == "stop":
        return cmd_stop()
    if args.cmd == "status":
        return cmd_status()
    if args.cmd == "url":
        return cmd_url()
    if args.cmd == "wait":
        return cmd_wait()
    return 2


if __name__ == "__main__":
    sys.exit(main())
