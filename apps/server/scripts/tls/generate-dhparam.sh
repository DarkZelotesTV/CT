#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SERVER_DIR=$(cd "${SCRIPT_DIR}/../.." && pwd)
DEFAULT_DHPARAM_PATH="${SERVER_DIR}/certs/dev/dhparam.pem"

DHPARAM_PATH="${TLS_DHPARAM_PATH:-${DEFAULT_DHPARAM_PATH}}"

mkdir -p "$(dirname "${DHPARAM_PATH}")"

openssl dhparam -out "${DHPARAM_PATH}" 2048

echo "✅ Generated dhparam at ${DHPARAM_PATH}"
