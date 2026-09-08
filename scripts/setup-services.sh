#!/usr/bin/env bash
set -euo pipefail
systemctl enable --now postgresql redis-server
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='im_app'" | grep -q 1 || sudo -u postgres psql -c "CREATE ROLE im_app LOGIN PASSWORD 'CHANGE_ME';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='im'" | grep -q 1 || sudo -u postgres createdb -O im_app im
redis-cli ping >/dev/null
echo 'PostgreSQL and Redis are running.'

# Tinode requires a static directory when static_mount is enabled.
mkdir -p third_party/tinode/server/static
printf 'Tinode server\n' > third_party/tinode/server/static/index.html
