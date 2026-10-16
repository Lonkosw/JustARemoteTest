#!/usr/bin/env bash
# Stops the backend started by start.sh and deletes its data.
set -uo pipefail

RUN="${TEST_BACKEND_DIR:-/tmp/treino-test-backend}"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"

for name in proxy postgrest; do
  [[ -f "$RUN/$name.pid" ]] && kill "$(cat "$RUN/$name.pid")" 2>/dev/null
done
if [[ -d "$RUN/data" ]]; then
  if [[ "$(id -u)" == "0" ]]; then
    runuser -u postgres -- "$PG_BIN/pg_ctl" -D "$RUN/data" -m fast stop >/dev/null 2>&1
  else
    "$PG_BIN/pg_ctl" -D "$RUN/data" -m fast stop >/dev/null 2>&1
  fi
fi
rm -rf "$RUN"
echo "test backend stopped"
