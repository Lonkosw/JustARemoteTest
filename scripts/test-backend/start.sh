#!/usr/bin/env bash
# Starts a throwaway Supabase-like backend for tests:
#   Postgres (with Supabase stubs and every migration) + PostgREST + a proxy
#   serving it at http://127.0.0.1:54321/rest/v1.
# Needs Postgres server binaries (apt install postgresql) and network access
# on first run to download PostgREST. Stop with scripts/test-backend/stop.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HERE="$ROOT/scripts/test-backend"
CACHE="$ROOT/.cache/test-backend"
# Short path: Unix socket paths are limited to ~107 bytes.
RUN="${TEST_BACKEND_DIR:-/tmp/treino-test-backend}"
PG_PORT="${PG_PORT:-5499}"
POSTGREST_VERSION="v12.2.3"

PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
if [[ -z "$PG_BIN" || ! -x "$PG_BIN/initdb" ]]; then
  echo "Postgres server binaries not found; set PG_BIN" >&2
  exit 1
fi

# initdb refuses to run as root; use the postgres user then.
as_pg() {
  if [[ "$(id -u)" == "0" ]]; then runuser -u postgres -- "$@"; else "$@"; fi
}

"$HERE/stop.sh" >/dev/null 2>&1 || true
rm -rf "$RUN"
mkdir -p "$RUN" "$CACHE"
[[ "$(id -u)" == "0" ]] && chown postgres "$RUN"

as_pg "$PG_BIN/initdb" -D "$RUN/data" -A trust -U postgres >/dev/null
as_pg "$PG_BIN/pg_ctl" -D "$RUN/data" -l "$RUN/postgres.log" -w \
  -o "-p $PG_PORT -k $RUN -c listen_addresses=127.0.0.1" start >/dev/null

PSQL=(psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$HERE/supabase-stubs.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$migration"
done
"${PSQL[@]}" -c "grant all on all tables in schema public to anon, authenticated;"

if [[ ! -x "$CACHE/postgrest" ]]; then
  curl -sSfL "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x64.tar.xz" \
    | tar -xJ -C "$CACHE"
fi

JWT_SECRET="$(node -e 'import("'"$HERE"'/jwt.mjs").then((m) => console.log(m.JWT_SECRET))')"
cat >"$RUN/postgrest.conf" <<EOF
db-uri = "postgres://authenticator@127.0.0.1:$PG_PORT/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 3301
EOF

nohup "$CACHE/postgrest" "$RUN/postgrest.conf" >"$RUN/postgrest.log" 2>&1 &
echo $! >"$RUN/postgrest.pid"
nohup node "$HERE/proxy.mjs" 54321 3301 >"$RUN/proxy.log" 2>&1 &
echo $! >"$RUN/proxy.pid"

for _ in $(seq 1 50); do
  if curl -sf -o /dev/null http://127.0.0.1:54321/rest/v1/; then
    echo "test backend ready: http://127.0.0.1:54321 (postgres on port $PG_PORT)"
    exit 0
  fi
  sleep 0.2
done
echo "test backend did not start; see $RUN/*.log" >&2
exit 1
