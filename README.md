# CloverTalk Monorepo

Dieses Repository enthält den Backend-Server (Express/Sequelize) und den Desktop-Client (Vite + Electron). Die folgenden Schritte richten sowohl lokale Entwicklung als auch produktionsreife Builds ein.

## Voraussetzungen
- Node.js 20+
- npm 10+
- Docker & Docker Compose (für MySQL/Redis/LiveKit)

## Infrastruktur starten
Die benötigten Datenbank- und Realtime-Dienste stehen im `docker-compose.yml` beschrieben.

```bash
# Abhängigkeiten hochfahren
docker compose up -d mysql redis livekit

# (Optional) phpMyAdmin öffnen: http://localhost:8080
```

## Server (apps/server)
1. Abhängigkeiten installieren: `npm install` (im Repo-Wurzelverzeichnis).
2. Build erstellen: `npm run build --workspace apps/server`
3. Datenbankschema anwenden: `npm run start --workspace apps/server`
   - Der Start führt `sequelize.sync({ alter: true })` aus und legt Tabellen entsprechend der Modelle an.
4. Für Produktion kann der kompilierten Output (`apps/server/dist`) mit `node dist/main.js` gestartet werden.

### Umgebungsvariablen
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` für MySQL
- ggf. weitere LiveKit- oder JWT-Variablen gemäß `.env` Beispiel

## Desktop-Client (apps/client)
1. Build & Typprüfung: `npm run build --workspace apps/client`
   - Renderer-Bundle landet unter `apps/client/dist`, Electron-Hauptprozess unter `apps/client/dist-electron`.
2. Installer/ZIP erzeugen: `npm run package --workspace apps/client`
   - Electron-Builder legt die Artefakte unter `apps/client/release` ab (NSIS/ZIP auf Windows, DMG/ZIP auf macOS, AppImage/ZIP auf Linux).
3. Während der Entwicklung: `npm run dev --workspace apps/client`
   - Der Electron-Mainprozess lädt automatisch das Vite-Dev-Server-Bundle.

## Full-Stack-Start (dev)
Optionaler paralleler Start von Client & Server:
```bash
npm run dev:server   # Backend mit ts-node-dev
npm run dev:client   # Vite-Entwicklungssserver
```

## Code-Qualität & Tests
- Linting: `npm run lint`
- Format-Check (Prettier): `npm run format`
- Typprüfung: `npm run typecheck`
- Tests (Platzhalter, solange keine Test-Suite existiert): `npm run test`

Alle Befehle triggern die passenden Skripte in `apps/client` und `apps/server` automatisch.

## Fehlerbehebung
- Prüfe, ob `docker compose ps` zeigt, dass MySQL/Redis/LiveKit laufen.
- Stelle sicher, dass `apps/server/.env` mit den MySQL-Zugangsdaten aus `docker-compose.yml` übereinstimmt.
