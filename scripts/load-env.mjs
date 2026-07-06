// Tiny .env loader + child process launcher for local development.
//
// Usage:
//   node scripts/load-env.mjs                       # load .env and print
//   node scripts/load-env.mjs -- vite ...           # load .env, then exec `vite ...`
//   node scripts/load-env.mjs PORT=5173 pnpm ...    # load .env + override PORT, then exec
//
// pnpm chains scripts with `&&`, which means each script runs in its own
// subshell — so any env vars set in one don't carry to the next. To work
// around that, this script accepts a command (and optional KEY=VALUE
// overrides) to launch after loading .env. The pnpm `dev:api` / `dev:web` /
// `dev:all` scripts call this script in exec mode, so env vars propagate
// naturally.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const envPath = resolve(repoRoot, ".env");
const args = process.argv.slice(2);

function loadDotenv() {
  if (!existsSync(envPath)) {
    console.warn(`[dev:env] no .env at ${envPath} — using whatever is in the environment`);
    return 0;
  }

  const raw = readFileSync(envPath, "utf8");
  const lines = raw.split(/\r?\n/);
  let loaded = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Don't clobber an env var already set in the shell.
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
    loaded += 1;
  }
  return loaded;
}

function applyDefaults() {
  if (process.env.BASE_PATH === undefined) process.env.BASE_PATH = "/";
  if (process.env.NODE_ENV === undefined) process.env.NODE_ENV = "development";
  if (process.env.DEV_AUTH === undefined) process.env.DEV_AUTH = "1";
  if (process.env.VITE_DEV_AUTH === undefined) process.env.VITE_DEV_AUTH = "1";
  if (process.env.CORS_ALLOWED_ORIGINS === undefined) {
    process.env.CORS_ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:8081";
  }
  // API_PORT / WEB_PORT are advisory; the per-process PORT is set by the
  // dev:api / dev:web / dev:all scripts via the PORT=... override.
}

function applyCallerOverrides(overrides) {
  for (const ov of overrides) {
    const eq = ov.indexOf("=");
    if (eq < 0) continue;
    const key = ov.slice(0, eq).trim();
    const value = ov.slice(eq + 1).trim();
    if (key) process.env[key] = value;
  }
}

function printSummary() {
  const visibleKeys = [
    "PORT",
    "BASE_PATH",
    "NODE_ENV",
    "DATABASE_URL",
    "DEV_AUTH",
    "VITE_DEV_AUTH",
    "AI_INTEGRATIONS_OPENROUTER_BASE_URL",
    "AI_INTEGRATIONS_OPENROUTER_API_KEY",
    "CORS_ALLOWED_ORIGINS",
  ];
  const summary = visibleKeys
    .filter((k) => process.env[k] !== undefined)
    .map((k) => {
      const v = process.env[k] ?? "";
      const masked =
        k.includes("KEY") || k.includes("SECRET") || k.includes("PASSWORD")
          ? v.length > 12
            ? `${v.slice(0, 6)}…${v.slice(-4)}`
            : v
          : v.length > 32
          ? `${v.slice(0, 24)}…`
          : v;
      return `${k}=${masked}`;
    })
    .join(" ");
  console.log(`[dev:env] ${summary}`);
}

const loaded = loadDotenv();
applyDefaults();

// Pull KEY=VALUE overrides out of args and apply them last so they win
// over both .env and the defaults above.
const callerOverrides = args.filter((a) => /^[A-Z_][A-Z0-9_]*=/.test(a));
applyCallerOverrides(callerOverrides);

printSummary();

// When invoked with no command, just exit (used by `pnpm dev:env` for sanity).
if (args.length === 0) {
  console.log(`[dev:env] loaded ${loaded} entries from .env; exiting (no command given)`);
  process.exit(0);
}

// Otherwise exec the requested command with the loaded env.
// Strip the KEY=VALUE overrides from the args before passing to the child.
const rest = args.filter((a) => !/^[A-Z_][A-Z0-9_]*=/.test(a));

const child = spawn(rest[0], rest.slice(1), {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
child.on("error", (err) => {
  console.error(`[dev:env] failed to launch ${rest[0]}:`, err);
  process.exit(1);
});
