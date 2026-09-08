#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test "$(git -C third_party/webapp rev-parse HEAD)" = b2bae67ed2e7166ff8794f8a48bb10e33745e651
python3 - <<'PY'
from pathlib import Path
import re
p=Path('third_party/webapp/src/config.js')
s=p.read_text()
s=re.sub(r"export const API_KEY = .*;", "export const API_KEY = '"+Path('.runtime/client-key').read_text().strip()+"';",s)
s=re.sub(r"export const KNOWN_HOSTS = .*;", "export const KNOWN_HOSTS = {hosted: 'api.cyfljj.com', local: 'api.cyfljj.com'};",s)
s=s.replace('export const LOGGING_ENABLED = true;', 'export const LOGGING_ENABLED = false;')
p.write_text(s)
p=Path('third_party/webapp/src/lib/host-name.js')
s=p.read_text().replace("host = window.location.hostname + (window.location.port ? ':' + window.location.port : '');", "host = DEFAULT_HOST;")
p.write_text(s)
PY
python3 scripts/brand-web.py
cd third_party/webapp
npm ci --ignore-scripts --no-audit --no-fund
npm run vers
npm run build:css
npm run build:i18n
npm run build:prod
mkdir -p ../../.runtime/web
cp index.html manifest.json service-worker.js version.js LICENSE ../../.runtime/web/
for dir in umd css img audio; do cp -R "$dir" ../../.runtime/web/; done
