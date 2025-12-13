# Clover Identity System (TS3-Style)

This project now uses a TeamSpeak-like identity login (local Ed25519 keypair + challenge/response).

## What changed

- Client generates and stores an identity locally (seed + public key).
- Client authenticates against the server via:
  - `POST /api/auth/challenge`
  - `POST /api/auth/verify`
- Server issues an app JWT (`clover_token`) used for:
  - HTTP API requests (`Authorization: Bearer <token>`)
  - Socket.io authentication (`handshake.auth.token`)
  - LiveKit token generation (`GET /api/livekit/token?room=...`)

## Run locally

1) Start infrastructure (LiveKit + Redis + MySQL):

```bash
docker compose up -d
```

2) Install dependencies (workspace):

```bash
npm install
```

3) Start dev:

```bash
npm run dev
```

## Notes about DB

- `sequelize.sync({ alter: true })` will attempt to update the `users` table automatically.
- New columns used for identity login:
  - `public_key` (base64, unique)
  - `identity_fingerprint` (sha256 hex, unique)
  - `display_name` (optional)

If you run into migration problems in dev, the quickest fix is usually to drop the `users` table and restart the server (it will recreate it).

## Storage keys in the client

- `clover_token` – app JWT (required)
- `clover_user` – cached user payload for UI
- `ct.identity.v1` – identity keypair (seed + pubkey)
