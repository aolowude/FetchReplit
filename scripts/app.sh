#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Fetch — start / stop / status / logs for the local dev environment.
#
# Usage:
#   pnpm start     # or: ./scripts/app.sh start
#   pnpm stop      # or: ./scripts/app.sh stop
#   pnpm restart   # or: ./scripts/app.sh restart
#   pnpm status    # or: ./scripts/app.sh status
#   pnpm logs      # or: ./scripts/app.sh logs
#   pnpm reset     # or: ./scripts/app.sh reset   # drops + re-pushes the DB schema
#
# The script is idempotent: running `start` while the app is already up
# just reports status. `stop` cleans up the app, the backgrounded pgserver
# Postgres, and any leftover processes.
#
# Database: a local Postgres is automatically started via the Python
# `pgserver` package inside .venv (no Docker required). The data directory
# lives in .run/pgdata/. If your .env has DATABASE_URL pointing at a
# different host, the script will use that and skip the local DB.
# ---------------------------------------------------------------------------

set -euo pipefail

# --- Paths & config ---------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_DIR="$REPO_ROOT/.run"
LOG_DIR="$RUN_DIR/logs"
PID_FILE="$RUN_DIR/app.pid"
PG_PID_FILE="$RUN_DIR/pg.pid"
STATUS_FILE="$RUN_DIR/status.json"
COMBINED_LOG="$LOG_DIR/app.log"
PG_LOG="$LOG_DIR/postgres.log"
API_PORT="${PORT:-8080}"
WEB_PORT_DEFAULT=5173
PG_CTL="python3 $SCRIPT_DIR/pg_ctl.py"

# Pretty output
BOLD="\033[1m"; DIM="\033[2m"; RED="\033[31m"; GRN="\033[32m"; YEL="\033[33m"; BLU="\033[34m"; RST="\033[0m"
say()  { printf "${BLU}==>${RST} ${BOLD}%s${RST}\n" "$*"; }
warn() { printf "${YEL}!!  ${RST}%s\n" "$*" >&2; }
die()  { printf "${RED}xx  ${RST}%s\n" "$*" >&2; exit 1; }
ok()   { printf "${GRN}ok  ${RST}%s\n" "$*"; }

ensure_dirs() { mkdir -p "$RUN_DIR" "$LOG_DIR"; }

# True if the parent app process is alive.
is_app_running() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid; pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

# True if our local pgserver is up (we wrote the PID file ourselves).
is_pg_running() {
  [[ -f "$PG_PID_FILE" ]] || return 1
  local pid; pid="$(cat "$PG_PID_FILE" 2>/dev/null || true)"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

# Extract host/port/db from a postgres:// DSN. Echoes: host port user pass db
parse_pg_dsn() {
  local dsn="$1"
  if [[ "$dsn" =~ ^postgres(ql)?://([^:@/]+)?:?([^@/]*)@([^:/]+):?([0-9]*)/([^?]+) ]]; then
    local user="${BASH_REMATCH[2]:-fetch}"
    local pass="${BASH_REMATCH[3]:-fetch}"
    local host="${BASH_REMATCH[4]}"
    local port="${BASH_REMATCH[5]:-5432}"
    local db="${BASH_REMATCH[6]%%\?*}"
    echo "$host" "$port" "$user" "$pass" "$db"
    return 0
  fi
  return 1
}

db_is_reachable() {
  local dsn="$1"
  local parts
  parts="$(parse_pg_dsn "$dsn")" || return 1
  local host port user pass db
  read -r host port user pass db <<<"$parts"
  if command -v nc >/dev/null 2>&1; then
    nc -z -G 2 "$host" "$port" 2>/dev/null && return 0
  fi
  (exec 3<>"/dev/tcp/$host/$port") 2>/dev/null
}

# Decide whether to use the local managed pg or trust the DSN the user
# provided. Returns 0 if we own the local pg, 1 if we don't.
uses_local_pg() {
  local dsn="${1:-}"
  [[ -n "$dsn" ]] || return 0
  local parts host port
  if parts="$(parse_pg_dsn "$dsn")"; then
    read -r host port _ _ _ <<<"$parts"
    [[ "$host" == "127.0.0.1" || "$host" == "localhost" ]] && [[ "$port" == "5432" || -z "$port" ]]
  else
    return 0
  fi
}

load_env_file() {
  local env_path="$REPO_ROOT/.env"
  [[ -f "$env_path" ]] || die "No .env found at $env_path — create one (see .env.example or re-run setup)."
  set -a
  # shellcheck disable=SC1090
  . "$env_path"
  set +a
}

push_schema() {
  say "Applying DB schema (drizzle push)…"
  if ! pnpm --config.verify-deps-before-run=never --filter @workspace/db run push; then
    die "Schema push failed. Check DATABASE_URL and that the DB is accepting connections."
  fi
  ok "Schema applied"
}

# --- Subcommands ------------------------------------------------------------
cmd_start() {
  ensure_dirs
  load_env_file

  if is_app_running; then
    warn "App is already running (pid $(cat "$PID_FILE")). Use \`pnpm restart\` to reload."
    cmd_status
    return 0
  fi

  say "Starting Fetch (dev mode)…"

  # 1. Install workspace deps if needed.
  if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
    say "Installing workspace dependencies (first run)…"
    pnpm install
  fi

  # 2. Bring up the database.
  local dsn="${DATABASE_URL:-}"
  [[ -n "$dsn" ]] || die "DATABASE_URL is not set in .env"

  if uses_local_pg "$dsn"; then
    say "Booting local Postgres (venv + pgserver)…"
    if ! "$PG_CTL" start; then
      die "Failed to start local Postgres. See $PG_LOG for details."
    fi
  else
    say "Using remote DATABASE_URL — skipping local Postgres."
    db_is_reachable "$dsn" || die "DATABASE_URL not reachable: $dsn"
  fi

  # 3. Apply the Drizzle schema.
  push_schema

  # 4. Launch the app.
  : > "$COMBINED_LOG"
  say "Launching API + web client (logs: $COMBINED_LOG)…"
  (
    cd "$REPO_ROOT"
    exec pnpm dev:all
  ) >> "$COMBINED_LOG" 2>&1 &

  local pid=$!
  echo "$pid" > "$PID_FILE"

  # 5. Wait for the API to answer /healthz.
  say "Waiting for API at http://localhost:$API_PORT/healthz…"
  local i
  for i in {1..30}; do
    if curl -fsS "http://localhost:$API_PORT/healthz" >/dev/null 2>&1; then
      ok "API is up (pid $pid)"
      printf '%s' "{\"api_pid\":$pid,\"started_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$STATUS_FILE"
      printf '\n'
      cat <<EOF

${BOLD}Fetch is running:${RST}
  Web  →  http://localhost:$WEB_PORT_DEFAULT
  API  →  http://localhost:$API_PORT
  DB   →  ${dsn}

Useful commands:
  pnpm logs     # tail the combined log
  pnpm status   # show process state
  pnpm stop     # stop everything
EOF
      return 0
    fi
    sleep 1
  done

  die "API did not start within 30s. Check $COMBINED_LOG for details."
}

cmd_stop() {
  ensure_dirs

  # Stop the app first.
  if is_app_running; then
    local pid; pid="$(cat "$PID_FILE")"
    say "Stopping app (pid $pid)…"
    local pgid
    pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
    if [[ -n "$pgid" ]]; then
      kill -TERM "-$pgid" 2>/dev/null || true
    else
      kill -TERM "$pid" 2>/dev/null || true
    fi
    local i
    for i in {1..10}; do
      if ! kill -0 "$pid" 2>/dev/null; then break; fi
      sleep 1
    done
    if kill -0 "$pid" 2>/dev/null; then
      warn "App did not exit gracefully; sending KILL"
      [[ -n "$pgid" ]] && kill -KILL "-$pgid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE" "$STATUS_FILE"
    ok "App stopped"
  else
    warn "No running app found."
    rm -f "$PID_FILE" "$STATUS_FILE"
  fi

  # Then stop the local pg only if we manage it.
  if [[ -f "$PID_FILE" || ! -f "$REPO_ROOT/.env" ]]; then
    : # if env not loaded, fall through; otherwise check below
  fi
  if [[ -f "$REPO_ROOT/.env" ]]; then
    load_env_file
    if uses_local_pg "${DATABASE_URL:-}"; then
      "$PG_CTL" stop || true
    fi
  else
    "$PG_CTL" stop || true
  fi
}

cmd_restart() {
  cmd_stop
  cmd_start
}

cmd_status() {
  ensure_dirs
  load_env_file
  local dsn="${DATABASE_URL:-}"

  printf "${BOLD}App:${RST}        "
  if is_app_running; then
    printf "${GRN}running${RST} (pid %s)\n" "$(cat "$PID_FILE")"
  else
    printf "${DIM}stopped${RST}\n"
  fi

  printf "${BOLD}DB:${RST}         "
  if [[ -z "$dsn" ]]; then
    printf "${RED}unconfigured${RST} (DATABASE_URL not set)\n"
  elif uses_local_pg "$dsn" && is_pg_running; then
    printf "${GRN}local running${RST} (pid %s) — %s\n" "$(cat "$PG_PID_FILE")" "$dsn"
  elif db_is_reachable "$dsn"; then
    printf "${GRN}reachable${RST} (%s)\n" "$dsn"
  else
    printf "${RED}unreachable${RST} (%s)\n" "$dsn"
  fi

  printf "${BOLD}Web URL:${RST}    http://localhost:%s\n" "$WEB_PORT_DEFAULT"
  printf "${BOLD}API URL:${RST}    http://localhost:%s\n" "$API_PORT"
  printf "${BOLD}Logs:${RST}       %s\n" "$COMBINED_LOG"
  [[ -f "$PG_LOG" ]] && printf "${BOLD}PG log:${RST}      %s\n" "$PG_LOG"
}

cmd_logs() {
  ensure_dirs
  if [[ ! -f "$COMBINED_LOG" ]]; then
    warn "No log file at $COMBINED_LOG yet. Has the app ever been started?"
    return 0
  fi
  exec tail -n 100 -f "$COMBINED_LOG"
}

cmd_reset() {
  ensure_dirs
  load_env_file
  local dsn="${DATABASE_URL:-}"
  [[ -n "$dsn" ]] || die "DATABASE_URL is not set in .env"

  if uses_local_pg "$dsn"; then
    say "Booting local Postgres (if not already running)…"
    "$PG_CTL" start || die "Local Postgres failed to start"
  else
    db_is_reachable "$dsn" || die "DATABASE_URL not reachable: $dsn"
  fi

  warn "This will drop and re-create the schema. All data will be lost."
  read -r -p "Continue? [y/N] " ans
  if [[ ! "$ans" =~ ^[Yy]$ ]]; then
    say "Aborted"
    return 0
  fi
  if pnpm --config.verify-deps-before-run=never --filter @workspace/db run drop; then
    ok "Schema dropped"
  else
    warn "Drop step didn't report success (it may not be implemented) — continuing."
  fi
  push_schema
}

usage() {
  cat <<EOF
Usage: $0 {start|stop|restart|status|logs|reset}
EOF
}

main() {
  local cmd="${1:-start}"
  case "$cmd" in
    start)   cmd_start ;;
    stop)    cmd_stop ;;
    restart) cmd_restart ;;
    status)  cmd_status ;;
    logs)    cmd_logs ;;
    reset)   cmd_reset ;;
    -h|--help|help) usage ;;
    *) die "Unknown command: $cmd (try: $0 start|stop|restart|status|logs|reset)" ;;
  esac
}

main "$@"
