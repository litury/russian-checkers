#!/usr/bin/env bash
# Run from this worktree. Uses only a new disposable DB and task-local ports.
set -euo pipefail
python3 - <<'PY'
import socket
for port in [19452,19453,19454]:
 s=socket.socket();s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);s.bind(('127.0.0.1',port));s.close()
PY
container=audio-t-d50b3179-repro-db
api_pid=''
vite_pid=''
cleanup() {
 if [ -n "$api_pid" ]; then kill "$api_pid" 2>/dev/null || true; fi
 if [ -n "$vite_pid" ]; then kill "$vite_pid" 2>/dev/null || true; fi
 docker --host=unix:///var/run/docker.sock stop "$container" >/dev/null
}
docker --host=unix:///var/run/docker.sock run --rm -d --name "$container" -e POSTGRES_USER=audio -e POSTGRES_PASSWORD=disposable-audio -e POSTGRES_DB=audio -p 127.0.0.1:19454:5432 postgres:16
trap cleanup EXIT
for i in {1..30}; do
 if docker --host=unix:///var/run/docker.sock exec "$container" pg_isready -U audio >/dev/null; then break; fi
 sleep 1
done
HOST=127.0.0.1 PORT=19453 DATABASE_URL=postgres://audio:disposable-audio@127.0.0.1:19454/audio ./node_modules/.bin/vite-node --config server/vite.config.ts server/src/index.ts > artifacts/checks/api-repro.log 2>&1 &
api_pid=$!
VITE_API_URL=http://127.0.0.1:19453 ./node_modules/.bin/vite --host 127.0.0.1 --port 19452 --strictPort > artifacts/checks/vite-repro.log 2>&1 &
vite_pid=$!
for i in {1..30}; do
 if curl --fail --silent http://127.0.0.1:19453/health >/dev/null && curl --fail --silent http://127.0.0.1:19452/ >/dev/null; then break; fi
 sleep 1
done
node artifacts/browser/verify.mjs
