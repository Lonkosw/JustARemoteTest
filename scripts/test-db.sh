#!/usr/bin/env bash
# Runs supabase/tests/*.sql against a fresh local test backend.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/test-backend/start.sh" || exit 1
status=0
for test in "$ROOT"/supabase/tests/*.sql; do
  echo "== $(basename "$test")"
  # Results go to /dev/null; the checks report through NOTICE / EXCEPTION.
  psql -h 127.0.0.1 -p "${PG_PORT:-5499}" -U postgres -v ON_ERROR_STOP=1 -q -o /dev/null -f "$test" 2>&1 \
    | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR): +/\1: /'
  [[ ${PIPESTATUS[0]} -ne 0 ]] && status=1
done
"$ROOT/scripts/test-backend/stop.sh" >/dev/null
exit $status
