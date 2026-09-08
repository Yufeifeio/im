#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Never reset databases or start another application's Redis service.
pg_isready
test -x bin/tinode
test -f .runtime/tinode.json
install -m 644 deploy/im-chat.service /etc/systemd/system/im-chat.service
systemctl daemon-reload
systemctl enable --now im-chat
systemctl is-active im-chat
