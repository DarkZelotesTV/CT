# CloverTalk Monorepo

Dieses Repository enthält den Backend-Server (Express/Sequelize) und den Desktop-Client (Vite + Electron). Der Client/Consumer kann ohne Container-Setup betrieben werden; der Server läuft gegen lokal verfügbare Dienste.

## Voraussetzungen
- Node.js 20+
- npm 10+
## Installation
Alle Abhängigkeiten werden einmalig im Repo-Wurzelverzeichnis installiert:

```bash
npm install
```

## Server (apps/server)
1. Build erstellen: `npm run build --workspace apps/server`
2. Migrationen anwenden: `npm run db:migrate --workspace apps/server`
   - `db:migrate:undo` bzw. `db:migrate:undo:all` machen Änderungen rückgängig, `db:migrate:status` zeigt den Stand.
3. Server starten: `npm run start --workspace apps/server` (setzt ein migriertes Schema voraus)
4. Für Produktion kann der kompilierte Output (`apps/server/dist`) mit `node dist/main.js` gestartet werden.

### Umgebungsvariablen
- `DB_DIALECT` (optional, `sqlite` oder `mysql`, Standard: `sqlite`)
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` für MySQL
- `DB_STORAGE` (optional, Pfad für SQLite-File, Standard: `apps/server/data/clovertalk.db`)
- ICE/STUN/TURN für den Client:
  - `VITE_ICE_SERVERS`: JSON-Array mit ICE-Server-Einträgen (z. B. `[{"urls":["stun:stun.example.org:3478"]},{"urls":["turn:turn.example.org:3478"],"username":"user","credential":"pass"}]`). Überschreibt die komplette ICE-Liste.
  - `VITE_STUN_URLS`: Komma- oder Whitespace-separierte STUN-URLs (Shortcut, wird mit TURN zusammengeführt).
  - `VITE_TURN_URLS`, `VITE_TURN_USERNAME`, `VITE_TURN_PASSWORD` (oder `VITE_TURN_CREDENTIAL`): TURN-Endpunkte inkl. Zugangsdaten.
  - Falls gesetzt, haben gespeicherte Nutzereinstellungen (`settings.talk.iceServers`) Vorrang vor den Umgebungsvariablen.

### Sequelize-Migrationen
- CLI-Konfiguration liegt unter `apps/server/sequelize.config.cjs`, die Pfade werden über `.sequelizerc` gesetzt.
- Migrationen liegen in `apps/server/src/migrations`.
- Ausführung (im Repo-Root oder im Server-Verzeichnis):
  - Anwenden: `npm run db:migrate --workspace apps/server`
  - Rückgängig: `npm run db:migrate:undo --workspace apps/server`
  - Komplett zurücksetzen: `npm run db:migrate:undo:all --workspace apps/server`
  - Status prüfen: `npm run db:migrate:status --workspace apps/server`

## Desktop-Client (apps/client)
1. Build & Typprüfung: `npm run build --workspace apps/client`
   - Renderer-Bundle landet unter `apps/client/dist`, Electron-Hauptprozess unter `apps/client/dist-electron`.
2. Installer/ZIP erzeugen: `npm run package --workspace apps/client`
   - Electron-Builder legt die Artefakte unter `apps/client/release` ab (NSIS/ZIP auf Windows, DMG/ZIP auf macOS, AppImage/ZIP auf Linux).
3. Während der Entwicklung: `npm run dev --workspace apps/client`
   - Der Electron-Mainprozess lädt automatisch das Vite-Dev-Server-Bundle.
- Ist der P2P-Voice-Provider aktiv, versucht der Client zunächst eine Direktverbindung und schwenkt bei einem Fehler automatisch auf den SFU/mediasoup-Fallback um (falls konfiguriert).

## Full-Stack-Start (dev)
Optionaler paralleler Start von Client & Server:
```bash
npm run dev:server   # Backend mit ts-node-dev
npm run dev:client   # Vite-Entwicklungssserver
```

## Code-Qualität & Tests
- Linting: `npm run lint`
- Banned color/classname check: `npm run lint:banned-colors`
- Format-Check (Prettier): `npm run format`
- Typprüfung: `npm run typecheck`
- Tests (Platzhalter, solange keine Test-Suite existiert): `npm run test`
- Kombinierter Pipeline-Lauf (CI-Äquivalent): `npm run ci`

Die Root-Skripte nutzen die npm-Workspaces, um die entsprechenden Befehle in `apps/client` und `apps/server` automatisch auszuführen.

Konfiguration für den Banned-Color-Check befindet sich in `scripts/banned-colors.json`. Zum expliziten Erlauben von Treffern die Zeile mit `// ct-allow-hardcoded-color` (oder `/* ct-allow-hardcoded-color */`) kommentieren.
