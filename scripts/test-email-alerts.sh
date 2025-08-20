#!/usr/bin/env bash
set -euo pipefail

BASE="http://localhost:5000/api/v1"
EMAIL="apurvrana09@gmail.com"
PASS="Passw0rd!"

log() { printf "\n[%s] %s\n" "$(date +"%H:%M:%S")" "$*"; }

log "Login"
LOGIN_JSON=$(curl -sS -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}") || true

TOKEN=$(printf "%s" "$LOGIN_JSON" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

if [ -z "$TOKEN" ]; then
  log "No token from login, attempting register"
  curl -sS -X POST "$BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"firstName\":\"Dev\",\"lastName\":\"User\"}" >/dev/null || true
  LOGIN_JSON=$(curl -sS -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
  TOKEN=$(printf "%s" "$LOGIN_JSON" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
fi

if [ -z "$TOKEN" ]; then
  echo "ERROR: Failed to obtain token. Raw login response:" >&2
  echo "$LOGIN_JSON" >&2
  exit 1
fi

log "Token acquired: ${TOKEN:0:12}..."

log "Create email-only BUILD_FAILURE alert"
CREATE_PAY='{"name":"Build Failures (Email)","type":"BUILD_FAILURE","conditions":{"recentMinutes":120},"channels":{"email":{"to":"'$EMAIL'"}},"isActive":true}'
CREATE_RESP=$(curl -sS -X POST "$BASE/alerts" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$CREATE_PAY" || true)
echo "$CREATE_RESP"
# Extract created alert id
ALERT_ID=$(printf "%s" "$CREATE_RESP" | python3 - <<'PY'
import sys, json
raw=sys.stdin.read().strip()
try:
  d=json.loads(raw)
  print(d.get('data',{}).get('id',''))
except Exception:
  print('')
PY
)
if [ -z "$ALERT_ID" ]; then
  # fallback: try to list and get the most recent
  LIST_JSON=$(curl -sS "$BASE/alerts?limit=1" -H "Authorization: Bearer $TOKEN" || true)
  ALERT_ID=$(printf "%s" "$LIST_JSON" | python3 - <<'PY'
import sys, json
raw=sys.stdin.read().strip()
try:
  d=json.loads(raw)
  items=d.get('data',[])
  print(items[0]['id'] if items else '')
except Exception:
  print('')
PY
)
fi
log "Using ALERT_ID=${ALERT_ID:-<none>}"

log "Send test email"
TEST_PAY='{"channels":{"email":{"to":"'$EMAIL'"}},"title":"Test Alert","text":"Hello from CI/CD Dashboard","alertId":"'$ALERT_ID'"}'
curl -sS -X POST "$BASE/alerts/test" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$TEST_PAY"

echo
log "Trigger evaluator (may require ADMIN, safe to ignore if forbidden)"
curl -sS -X POST "$BASE/alerts/trigger" -H "Authorization: Bearer $TOKEN" || true

echo
log "Fetch recent alert history for ALERT_ID"
curl -sS "$BASE/alerts/history?page=1&limit=5&alertId=$ALERT_ID" -H "Authorization: Bearer $TOKEN" | sed 's/.*/HISTORY: &/'

echo
log "Done. Open Mailpit UI: http://localhost:8025"
