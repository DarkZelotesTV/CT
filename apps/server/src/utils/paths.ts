import path from 'path';

/**
 * Centralized filesystem paths for the server.
 *
 * IMPORTANT:
 * Do NOT use __dirname-relative paths in feature modules (e.g. routes),
 * because after TypeScript compilation their __dirname changes (dist/routes/...),
 * which can lead to uploads being written to a different directory than where
 * Express serves static files from.
 *
 * We anchor all paths to process.cwd(), which is stable because:
 * - local dev scripts run inside apps/server
 * - docker WORKDIR is /app/apps/server
 * - npm start is executed from apps/server
 */
export const SERVER_CWD = process.cwd();

export const PUBLIC_DIR = path.resolve(SERVER_CWD, 'public');
export const UPLOADS_DIR = path.resolve(PUBLIC_DIR, 'uploads');

export const AVATARS_DIR = path.resolve(UPLOADS_DIR, 'avatars');
export const SERVER_ICONS_DIR = path.resolve(UPLOADS_DIR, 'server-icons');
