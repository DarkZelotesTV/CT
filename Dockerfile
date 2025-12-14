# Wir nutzen ein leichtes Node.js Image als Basis
FROM node:18-alpine

# Arbeitsverzeichnis im Container erstellen
WORKDIR /app

# 1. Package-Dateien kopieren (für Caching der Installation)
# Wir kopieren die Root-Files und die spezifischen Paket-Files
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/
COPY packages/shared/package.json ./packages/shared/

# 2. Abhängigkeiten installieren
# 'npm ci' ist schneller und sauberer für CI/CD/Docker als 'npm install'
RUN npm ci

# 3. Den gesamten Quellcode kopieren
COPY . .

# 4. Shared Library und Server bauen
# Wir bauen zuerst das Shared Package, da der Server es braucht
RUN npm run build --workspace=packages/shared
# Dann bauen wir den Server (TypeScript zu JavaScript)
RUN npm run build --workspace=apps/server

# 5. Umgebungsvariablen für Production setzen
ENV NODE_ENV=production

# 6. Startbefehl festlegen
# Wir wechseln in das Server-Verzeichnis und starten von dort
WORKDIR /app/apps/server
CMD ["npm", "start"]