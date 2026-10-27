#!/bin/bash
# REA benchmark: runs the built-in ?bench route (60 s) in a real Chrome and
# prints the summary the page logs. Needs a dev or preview server.
#   scripts/look/bench.sh <tier> [port] [label]
tier=${1:-high}; port=${2:-4173}; label=${3:-$tier}
dir=$(mktemp -d); chrome=${CHROME:-$(command -v google-chrome || command -v chromium)}
cat > "$dir/bench.json" <<J
{
  "browser": { "mode": "launch", "executable_path": "$chrome", "headless": false },
  "start_url": { "url": "http://127.0.0.1:$port/?time=21:30&weather=clear&guide=0&bench=1&quality=$tier${EXTRA:-}" },
  "actions": [
    { "step_id": "ready", "action": "wait_for", "locator": { "kind": "css", "selector": ".js-city-start:not([disabled])" }, "state": "visible", "timeout_ms": 90000 },
    { "step_id": "enter", "action": "click", "locator": { "kind": "css", "selector": ".js-city-start" }, "timeout_ms": 10000 },
    { "step_id": "run", "action": "wait_for_timeout", "duration_ms": ${RUN_MS:-110000} }
  ],
  "capture": { "at_end": ["url"], "events": ["console", "page-errors"] }
}
J
npx -y rea-agents@latest capture-browser-scenario "$dir/bench.json" --format json > "$dir/out.json" 2>/dev/null || true
python3 - "$dir/out.json" "$label" <<'P'
import json, re, sys
raw = open(sys.argv[1]).read().replace('\\"', '"')
m = re.search(r'Portfolio benchmark (\{.*?\})"', raw)
if not m:
    print(sys.argv[2], 'NO RESULT'); sys.exit()
r = json.loads(m.group(1))
ring = re.search(r'megacity-ring (\{.*?\})"', raw)
print(sys.argv[2], {k: (round(r[k], 1) if isinstance(r.get(k), float) else r.get(k)) for k in ('averageFps', 'p95Ms', 'maxDraws', 'maxTriangles', 'tier', 'dpr', 'interrupted')}, ring.group(1) if ring else 'no ring')
P
rm -rf "$dir"
