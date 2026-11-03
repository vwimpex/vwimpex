#!/usr/bin/env bash
# Local development server.
#   ./dev.sh                         → hugo server with 50 sample products per category (fast)
#   ./dev.sh <product-slug>          → also builds that product (+ 100 around it), e.g. ./dev.sh rexroth-ball-bearings-r0531-212-10
#   ./dev.sh <category-slug>         → one whole category, e.g. ./dev.sh gearbox  (ball-bearings ≈ 65k pages: slow, needs RAM)
#   PORT=1414 ./dev.sh ...           → other port (default 1313)
set -euo pipefail
cd "$(dirname "$0")"
ARG="${1:-}"
PRODUCTS="sample"
if [[ -n "$ARG" ]]; then
  PRODUCTS="$(python3 - "$ARG" <<'PY'
import json, glob, os, sys
arg = sys.argv[1].strip().strip('/').split('/')[-1]
if os.path.exists(f"data/products/{arg}.json"):
    print(arg); sys.exit()
for f in sorted(glob.glob('data/products/*.json')):
    items = json.load(open(f))
    for i, p in enumerate(items):
        if p['slug'] == arg:
            cat = os.path.basename(f)[:-5]
            print(f"{cat}@{max(0, i - 50)}-{i + 50}"); sys.exit()
sys.stderr.write(f"'{arg}' is not a product slug or category in data/products/\n"); sys.exit(1)
PY
)"
fi
# product data for products not built locally (shown by the 404 page)
[[ -d static/pdata && -z "$(find data/products -name "*.json" -newer static/pdata | head -1)" ]] || python3 scripts/build_pdata.py .
PORT="${PORT:-1313}"
echo "HUGO_PRODUCTS=$PRODUCTS"
[[ -n "$ARG" && "$PRODUCTS" == *@* ]] && echo "Open: http://localhost:$PORT/product/$(basename "$ARG")"
HUGO_PRODUCTS="$PRODUCTS" exec hugo server --port "$PORT" --disableFastRender
