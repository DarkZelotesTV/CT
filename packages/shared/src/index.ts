// Hier definieren wir Datenstrukturen, die beide Seiten kennen müssen
export interface User {
  id: string;
  username: string;
  avatarUrl?: string;
}

export * from './types';
export * from './socket-events';
