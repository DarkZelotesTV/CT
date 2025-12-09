// Hier definieren wir Datenstrukturen, die beide Seiten kennen müssen
export interface User {
  id: string;
  username: string;
  avatarUrl?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  timestamp: number;
}