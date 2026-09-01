#!/bin/bash
# npm test — unit tests for the auth primitives, then the API suite against the
# real function handlers on a fresh in-memory store.
set -u
cd "$(dirname "$0")"

PORT=${PORT:-8901}

if [ -f .server.pid ]; then
  kill "$(cat .server.pid)" 2>/dev/null
  rm -f .server.pid
  sleep 1
fi

echo "===== auth primitives ====="
ENTRY_PASSCODE=cambodia2033 DIRECTOR_PHONE="012 111 222" \
  node --import ./loader.mjs unit.test.mjs
unit=$?

ENTRY_PASSCODE=cambodia2033 DIRECTOR_PHONE="012 111 222" PORT=$PORT \
  node --import ./loader.mjs server.mjs > .server.log 2>&1 &
# The server writes its own PID: it may outlive the shell that started it.
for i in $(seq 1 30); do
  curl -sf -o /dev/null "http://localhost:$PORT/" && break
  sleep 0.3
done

echo
echo "===== api ====="
PORT=$PORT node api.test.mjs
api=$?

if [ -f .server.pid ]; then
  kill "$(cat .server.pid)" 2>/dev/null
  rm -f .server.pid
fi

if [ $unit -ne 0 ] || [ $api -ne 0 ]; then
  echo
  echo "FAILURES"
  exit 1
fi
echo
echo "everything passed"
