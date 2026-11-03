#!/usr/bin/env bash
# Full production build in chunks (Hugo keeps every page in memory; ~240k product pages at once needs >8 GB).
# 1) base site (all non-product pages + sitemaps)  2) product pages, ~40k per run, added into the same public/
set -euo pipefail
HUGO="hugo --minify --gc"
HUGO_PRODUCTS=none $HUGO --cleanDestinationDir
CHUNKS=(
  "ball-bearings@0-33000" "ball-bearings@33000-70000"
  "roller-bearings@0-26000" "roller-bearings@26000-60000"
  "special-bearings@0-25000" "special-bearings@25000-60000"
  "housings,thrust-bearings,couplings,gearbox,tools-for-bearings,power-transmission,clamping-element,bearing-accessories,roller-and-inline-skates-accessories"
  "linear-bearings,sealssnap-rings,clutch-and-brakes,parts-for-bearings"
)
for c in "${CHUNKS[@]}"; do
  echo "== products: $c"
  HUGO_PRODUCTS="$c" $HUGO --disableKinds sitemap,robotstxt,404
done
rm -rf public/pdata   # every product has its own page here
echo "Pages: $(find public -name '*.html' | wc -l)"
