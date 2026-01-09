#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SERVER_DIR=$(cd "${SCRIPT_DIR}/../.." && pwd)
DEFAULT_CERT_PATH="${SERVER_DIR}/certs/dev/cert.pem"
DEFAULT_KEY_PATH="${SERVER_DIR}/certs/dev/privkey.pem"

CERT_PATH="${TLS_CERT_PATH:-${DEFAULT_CERT_PATH}}"
KEY_PATH="${TLS_KEY_PATH:-${DEFAULT_KEY_PATH}}"

fail() {
  echo "❌ $1" >&2
  exit 1
}

if [[ ! -f "${CERT_PATH}" ]]; then
  fail "Certificate not found at ${CERT_PATH}"
fi

if [[ ! -f "${KEY_PATH}" ]]; then
  fail "Key not found at ${KEY_PATH}"
fi

cert_modulus=$(openssl x509 -noout -modulus -in "${CERT_PATH}" | openssl md5)
key_modulus=$(openssl rsa -noout -modulus -in "${KEY_PATH}" | openssl md5)

if [[ "${cert_modulus}" != "${key_modulus}" ]]; then
  fail "Certificate and key modulus do not match."
fi

if ! openssl x509 -noout -checkend 0 -in "${CERT_PATH}" >/dev/null 2>&1; then
  fail "Certificate is expired."
fi

required_sans=()
if [[ -n "${TLS_REQUIRED_SANS:-}" ]]; then
  IFS=',' read -r -a required_sans <<< "${TLS_REQUIRED_SANS}"
else
  required_sans=("DNS:localhost" "IP Address:127.0.0.1" "IP Address:::1")
fi

if [[ -n "${DEV_DOMAIN:-}" ]]; then
  has_dev_domain=false
  for entry in "${required_sans[@]}"; do
    if [[ "${entry}" == "DNS:${DEV_DOMAIN}" ]]; then
      has_dev_domain=true
      break
    fi
  done
  if [[ "${has_dev_domain}" == "false" ]]; then
    required_sans+=("DNS:${DEV_DOMAIN}")
  fi
fi

san_output=$(openssl x509 -noout -ext subjectAltName -in "${CERT_PATH}" 2>/dev/null || true)
if [[ -z "${san_output}" ]]; then
  fail "Certificate is missing Subject Alternative Name entries."
fi

san_values=$(echo "${san_output}" | tail -n +2 | tr '\n' ' ' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

for entry in "${required_sans[@]}"; do
  trimmed_entry=$(echo "${entry}" | xargs)
  if [[ -n "${trimmed_entry}" && "${san_values}" != *"${trimmed_entry}"* ]]; then
    fail "Certificate is missing SAN entry: ${trimmed_entry}"
  fi
done

echo "✅ TLS certificate checks passed for ${CERT_PATH}"
