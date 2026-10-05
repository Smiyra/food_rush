#!/bin/bash
set -e

echo "▶  Starting MariaDB..."
service mariadb start

echo "▶  Waiting for MariaDB to be ready..."
for i in {1..30}; do
  if mysqladmin ping --silent 2>/dev/null; then
    echo "✅  MariaDB is up!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "❌  MariaDB failed to start within 60 seconds"
    exit 1
  fi
  echo "   Waiting... ($i/30)"
  sleep 2
done

echo "▶  Running database setup (schema + seed)..."
node database/setup.js

echo "▶  Starting Node.js app on port ${PORT:-10000}..."

# Graceful shutdown — stop Node then MariaDB
cleanup() {
  echo "▶  Shutting down..."
  kill "$NODE_PID" 2>/dev/null || true
  service mariadb stop 2>/dev/null || true
  exit 0
}
trap cleanup SIGTERM SIGINT

# Use exec-style background + wait so signals propagate
node server/index.js &
NODE_PID=$!
wait "$NODE_PID"
