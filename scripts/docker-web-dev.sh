#!/bin/sh
set -eu

cd /app

NEXT_CACHE_DIR="apps/web/.next"
NEXT_HOST="${NEXT_HOST:-0.0.0.0}"
NEXT_RUNTIME="${SLOG_NEXT_RUNTIME:-node}"
NEXT_DEV_BUNDLER="${SLOG_NEXT_DEV_BUNDLER:-turbopack}"
WATCH_INTERVAL="${SLOG_DEP_WATCH_INTERVAL:-2}"
NEXT_PID=""

clear_next_cache() {
  mkdir -p "$NEXT_CACHE_DIR"
  rm -rf "$NEXT_CACHE_DIR"/* "$NEXT_CACHE_DIR"/.[!.]* "$NEXT_CACHE_DIR"/..?*
}

dependency_fingerprint() {
  {
    bun --version
    for file in package.json bun.lock apps/web/package.json apps/cli/package.json apps/web/next.config.mjs; do
      if [ -f "$file" ]; then
        cksum "$file"
      else
        printf 'missing %s\n' "$file"
      fi
    done
  } 2>/dev/null
}

stop_next() {
  if [ -n "$NEXT_PID" ] && kill -0 "$NEXT_PID" 2>/dev/null; then
    kill "$NEXT_PID" 2>/dev/null || true
    wait "$NEXT_PID" 2>/dev/null || true
  fi
  NEXT_PID=""
}

next_dev_bundler_flag() {
  case "$NEXT_DEV_BUNDLER" in
    webpack)
      printf '%s\n' "--webpack"
      ;;
    turbo|turbopack)
      printf '%s\n' "--turbopack"
      ;;
    none|"")
      printf '%s\n' ""
      ;;
    *)
      printf 'Unsupported SLOG_NEXT_DEV_BUNDLER=%s. Use webpack, turbopack, or none.\n' "$NEXT_DEV_BUNDLER" >&2
      exit 1
      ;;
  esac
}

start_next() {
  BUNDLER_FLAG="$(next_dev_bundler_flag)"

  case "$NEXT_RUNTIME" in
    node)
      if [ -n "${NEXT_PORT:-}" ]; then
        if [ -n "$BUNDLER_FLAG" ]; then
          (cd apps/web && node node_modules/next/dist/bin/next dev "$BUNDLER_FLAG" --hostname "$NEXT_HOST" --port "$NEXT_PORT") &
        else
          (cd apps/web && node node_modules/next/dist/bin/next dev --hostname "$NEXT_HOST" --port "$NEXT_PORT") &
        fi
      else
        if [ -n "$BUNDLER_FLAG" ]; then
          (cd apps/web && node node_modules/next/dist/bin/next dev "$BUNDLER_FLAG" --hostname "$NEXT_HOST") &
        else
          (cd apps/web && node node_modules/next/dist/bin/next dev --hostname "$NEXT_HOST") &
        fi
      fi
      ;;
    bun)
      if [ -n "${NEXT_PORT:-}" ]; then
        if [ -n "$BUNDLER_FLAG" ]; then
          bun run --cwd apps/web next dev "$BUNDLER_FLAG" --hostname "$NEXT_HOST" --port "$NEXT_PORT" &
        else
          bun run --cwd apps/web next dev --hostname "$NEXT_HOST" --port "$NEXT_PORT" &
        fi
      else
        if [ -n "$BUNDLER_FLAG" ]; then
          bun run --cwd apps/web next dev "$BUNDLER_FLAG" --hostname "$NEXT_HOST" &
        else
          bun run --cwd apps/web next dev --hostname "$NEXT_HOST" &
        fi
      fi
      ;;
    *)
      printf 'Unsupported SLOG_NEXT_RUNTIME=%s. Use node or bun.\n' "$NEXT_RUNTIME" >&2
      exit 1
      ;;
  esac

  NEXT_PID="$!"
}

cleanup() {
  stop_next
}

trap cleanup INT TERM EXIT

while :; do
  FINGERPRINT="$(dependency_fingerprint)"

  bun install --frozen-lockfile

  # Never let compiled chunks survive dependency churn.
  clear_next_cache

  if [ "${SLOG_DB_PUSH_ON_START:-0}" = "1" ]; then
    bun run --cwd apps/web db:push
  fi

  start_next

  RESTART_NEXT="0"

  while kill -0 "$NEXT_PID" 2>/dev/null; do
    sleep "$WATCH_INTERVAL"
    NEXT_FINGERPRINT="$(dependency_fingerprint)"
    if [ "$NEXT_FINGERPRINT" != "$FINGERPRINT" ]; then
      echo "Dependency manifests changed; reinstalling and restarting Next dev..."
      RESTART_NEXT="1"
      stop_next
      break
    fi
  done

  if [ "$RESTART_NEXT" = "1" ]; then
    continue
  fi

  set +e
  wait "$NEXT_PID"
  NEXT_STATUS="$?"
  set -e

  NEXT_FINGERPRINT="$(dependency_fingerprint)"
  if [ "$NEXT_FINGERPRINT" != "$FINGERPRINT" ]; then
    echo "Next exited after dependency manifests changed; restarting..."
    NEXT_PID=""
    continue
  fi

  exit "$NEXT_STATUS"
done
