#!/usr/bin/env bash
# Read-only checks against an already running deployment. No demo accounts or writes.
set -euo pipefail

: "${APP_ORIGIN:?Set APP_ORIGIN to the frontend HTTPS origin}"
: "${API_ORIGIN:?Set API_ORIGIN to the backend HTTPS origin}"
APP_ORIGIN=${APP_ORIGIN%/}
API_ORIGIN=${API_ORIGIN%/}
case "$APP_ORIGIN $API_ORIGIN" in
  https://*" https://"*) ;;
  *) echo "Both origins must use HTTPS." >&2; exit 1 ;;
esac

curl_options=(--silent --show-error --connect-timeout 10 --max-time 30 --proto '=https')
if [[ -n "${CA_CERT:-}" ]]; then
  curl_options+=(--cacert "$CA_CERT")
fi
smoke_dir=$(mktemp -d)
trap 'rm -rf "$smoke_dir"' EXIT

curl "${curl_options[@]}" --fail "$APP_ORIGIN/" -o "$smoke_dir/index.html"
asset_path=$(python3 - "$smoke_dir/index.html" <<'PY'
import re
import sys
from pathlib import Path
html = Path(sys.argv[1]).read_text()
assert 'id="root"' in html, "Missing React root"
asset = re.search(r'<script[^>]+src="(/assets/[^\"]+\.js)"', html)
assert asset, "Missing compiled frontend script"
print(asset.group(1))
PY
)
curl "${curl_options[@]}" --fail "$APP_ORIGIN$asset_path" -o /dev/null
curl "${curl_options[@]}" --fail "$APP_ORIGIN/account/orders" -o "$smoke_dir/deep-link.html"
cmp "$smoke_dir/index.html" "$smoke_dir/deep-link.html"

for origin in "$APP_ORIGIN" "$API_ORIGIN"; do
  curl "${curl_options[@]}" --fail "$origin/health/" -o "$smoke_dir/health.json"
  python3 - "$smoke_dir/health.json" <<'PY'
import json
import sys
with open(sys.argv[1]) as source:
    assert json.load(source)["status"] == "ok"
PY
  curl "${curl_options[@]}" --fail "$origin/api/v1/products/" -o "$smoke_dir/catalog.json"
  python3 - "$smoke_dir/catalog.json" <<'PY'
import json
import sys
with open(sys.argv[1]) as source:
    payload = json.load(source)
assert isinstance(payload, list) or (isinstance(payload, dict) and isinstance(payload.get("results"), list)), "Unexpected catalog response"
PY
  private_status=$(curl "${curl_options[@]}" "$origin/api/v1/users/me/" -o /dev/null -w '%{http_code}')
  [[ "$private_status" == 401 ]] || { echo "Expected anonymous profile status 401, got $private_status" >&2; exit 1; }
done

curl "${curl_options[@]}" --fail "$API_ORIGIN/static/admin/css/base.css" -o /dev/null
missing_status=$(curl "${curl_options[@]}" "$APP_ORIGIN/assets/agronexus-smoke-missing.js" -o /dev/null -w '%{http_code}')
[[ "$missing_status" == 404 ]] || { echo "Missing assets must return 404." >&2; exit 1; }
echo "Smoke passed: frontend, deep link, JS, static files, API, catalog database query and anonymous permissions."
