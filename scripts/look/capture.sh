#!/bin/bash
# REA look capture: renders one ?shot= pose in a real (headed) Chrome and saves
# the frame plus the logged lighting state. Needs `npm run dev` on port 4173.
#   scripts/look/capture.sh <outdir> <shot> <HH:MM> [weather] [tier]
# Shots: see src/javascript/World/LookShots.js. EXTRA appends query params, SETTLE_MS waits longer.
set -e
out=$1; shot=$2; t=$3; weather=${4:-clear}; tier=${5:-high}
chrome=${CHROME:-$(command -v google-chrome || command -v chromium)}
mkdir -p "$out"; tag="$shot-${t/:/}"
cat > "$out/$tag.scenario.json" <<J
{
  "browser": { "mode": "launch", "executable_path": "$chrome", "headless": false },
  "start_url": { "url": "http://127.0.0.1:4173/?time=$t&weather=$weather&guide=0&shot=$shot&quality=$tier${EXTRA:-}" },
  "actions": [
    { "step_id": "ready", "action": "wait_for", "locator": { "kind": "css", "selector": ".js-city-start:not([disabled])" }, "state": "visible", "timeout_ms": 90000 },
    { "step_id": "enter", "action": "click", "locator": { "kind": "css", "selector": ".js-city-start" }, "timeout_ms": 10000 },
    { "step_id": "settle", "action": "wait_for_timeout", "duration_ms": ${SETTLE_MS:-9000} }
  ],
  "capture": { "at_end": ["screenshot"], "events": ["console", "page-errors"] }
}
J
npx -y rea-agents@latest capture-browser-scenario "$(realpath "$out/$tag.scenario.json")" --format json > "$out/$tag.capture.json" 2>/dev/null || true
python3 - "$out/$tag.capture.json" "$out/$tag.png" <<'P'
import json, sys, base64, re
raw = open(sys.argv[1]).read(); d = json.loads(raw)
root = d.get('normalized_result') or d.get('details', {}).get('partial_observation', {}).get('capture', {})
image = next((s['artifacts']['screenshot']['value']['data_base64'] for s in reversed(root.get('steps', []))
              if ((s.get('artifacts') or {}).get('screenshot') or {}).get('value', {}).get('data_base64')), None)
if image: open(sys.argv[2], 'wb').write(base64.b64decode(image))
unescaped = raw.replace('\\"', '"')
look = re.search(r'look-review (\{.*?\})"', unescaped)
ring = re.search(r'megacity-ring (\{.*?\})"', unescaped)
errors = sorted(set(m for m in re.findall(r'"(?:text|message)": "([^"]*(?:Error|error|failed)[^"]*)"', raw)))[:3]
print(sys.argv[2].split('/')[-1], 'ok' if image else 'NO IMAGE', look.group(1) if look else '', ring.group(1) if ring else 'ring: not ready', errors or '')
P
