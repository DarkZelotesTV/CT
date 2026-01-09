#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SERVER_DIR=$(cd "${SCRIPT_DIR}/../.." && pwd)
CERT_DIR="${SERVER_DIR}/certs/dev"

mkdir -p "${CERT_DIR}"
rm -f \
  "${CERT_DIR}/ca.key" \
  "${CERT_DIR}/ca.pem" \
  "${CERT_DIR}/privkey.pem" \
  "${CERT_DIR}/cert.pem" \
  "${CERT_DIR}/fullchain.pem" \
  "${CERT_DIR}/server.csr" \
  "${CERT_DIR}/ca.srl"

san_entries=("DNS:localhost" "IP:127.0.0.1" "IP:::1")
if [[ -n "${DEV_DOMAIN:-}" ]]; then
  san_entries+=("DNS:${DEV_DOMAIN}")
fi
san_list=$(IFS=,; echo "${san_entries[*]}")

extfile=$(mktemp)
trap 'rm -f "${extfile}" "${CERT_DIR}/server.csr"' EXIT

cat > "${extfile}" <<EOF
[req]
distinguished_name=req_distinguished_name
req_extensions=v3_req
prompt=no

[req_distinguished_name]
CN=localhost

[v3_req]
subjectAltName=${san_list}
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
EOF

openssl req \
  -x509 \
  -newkey rsa:2048 \
  -nodes \
  -keyout "${CERT_DIR}/ca.key" \
  -out "${CERT_DIR}/ca.pem" \
  -days 825 \
  -sha256 \
  -subj "/CN=Dev Local CA" \
  -set_serial 01

openssl genrsa -out "${CERT_DIR}/privkey.pem" 2048

openssl req \
  -new \
  -key "${CERT_DIR}/privkey.pem" \
  -out "${CERT_DIR}/server.csr" \
  -config "${extfile}"

openssl x509 \
  -req \
  -in "${CERT_DIR}/server.csr" \
  -CA "${CERT_DIR}/ca.pem" \
  -CAkey "${CERT_DIR}/ca.key" \
  -out "${CERT_DIR}/cert.pem" \
  -days 825 \
  -sha256 \
  -set_serial 02 \
  -extfile "${extfile}" \
  -extensions v3_req

cat "${CERT_DIR}/cert.pem" "${CERT_DIR}/ca.pem" > "${CERT_DIR}/fullchain.pem"
