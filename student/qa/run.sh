#!/bin/sh
# Operator QA of the EXISTING student test deployment, NOT a student installer.
# From the same repository root as docker compose up: sh student/qa/run.sh
# DESTRUCTIVE: tests modify data and the final factory reset removes ALL
# named volumes of the xpup-student-local test Compose project.
set -eu

dc() { docker compose -f compose.yaml "$@"; }

app_cid=$(dc ps -q app)
if [ -z "$app_cid" ]; then
  echo "REFUSED: no running student app in this Compose project."
  exit 2
fi
project=$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$app_cid")
running=$(docker inspect --format '{{ .State.Running }}' "$app_cid")
if [ "$project" != "xpup-student-local" ] || [ "$running" != "true" ]; then
  echo "REFUSED: expected running xpup-student-local, got project=$project running=$running"
  exit 2
fi

echo "=== EXISTING TEST DEPLOYMENT: $project ==="
echo "=== ALL DATA IN THIS TEST DEPLOYMENT WILL BE RESET AT THE END ==="
fail=0

# Builds only the QA runner. Does not recreate or rebuild the running app.
dc build acceptance
echo "=== CHECK RUNNING APP + MAILBOX ==="
dc run --rm --no-deps acceptance wait

echo "=== L1-L9 FUNCTIONAL TESTS ON EXISTING INSTANCE ==="
dc run --rm --no-deps acceptance main || fail=1

echo "=== L3 ROLE REVOCATION ON EXISTING INSTANCE ==="
if dc run --rm --no-deps acceptance role-prepare; then
  if dc run --rm --no-deps instructor-role t@lab.test customer; then
    dc run --rm --no-deps acceptance role-check || fail=1
  else
    echo "FAIL instructor-role service"
    fail=1
  fi
else
  echo "FAIL role preparation"
  fail=1
fi

echo "=== O-RESTART: EXISTING APP ==="
dc restart app
dc run --rm --no-deps acceptance persist || fail=1

echo "=== O-RESET: REMOVE AND RECREATE THE TEST INSTANCE'S VOLUMES ==="
dc down --volumes --remove-orphans
dc up -d --no-build
dc run --rm --no-deps acceptance reset || fail=1

echo "=== FINAL STATUS ==="
dc ps --all
if [ "$fail" -ne 0 ]; then
  echo "QA RESULT: FAIL (check individual PASS/FAIL/SKIP entries)"
  exit 1
fi
echo "QA RESULT: PASS for executed checks; explicit SKIPs remain."
