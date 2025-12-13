# Identity handshake without JWT

## Client flow
1. User enters the CloverTalk server URL/IP and optional `SERVER_PASSWORD`.
2. Client loads the local identity keypair and signs a short-lived message `handshake:{timestamp}`.
3. The app sends `/api/auth/handshake` to the chosen server with:
   - `publicKey` (base64 Ed25519 public key)
   - `fingerprint` (SHA-256 of the public key)
   - optional `displayName`
   - optional `serverPassword`
   - `signature` + `timestamp` proving private key possession
4. On success the client stores the resolved user and reuses the same headers for all HTTP/Socke
   t/LiveKit calls.

## Server-side validation
- Password protection via `SERVER_PASSWORD`; `SERVER_FINGERPRINT_WHITELIST` allows bypass for
  trusted fingerprints.
- `X-Identity-*` + `X-Server-Password` headers are accepted on every request; the server recreat
  es or updates the user row on the fly.
- Signatures are validated against `handshake:{timestamp}` and must be within ±2 minutes.

## Required headers for authenticated calls
```
X-Server-Password: <optional server password>
X-Identity-PublicKey: <base64 Ed25519 public key>
X-Identity-Fingerprint: <sha256 hex fingerprint>
X-Identity-DisplayName: <optional display name>
X-Identity-Signature: <base64 signature over handshake:{timestamp}>
X-Identity-Timestamp: <unix ms timestamp used for the signature>
```

These are automatically attached by the client `apiFetch` helper and the Socket.IO auth payload.
