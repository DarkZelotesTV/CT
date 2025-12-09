export const DEFAULT_SERVER = 'http://localhost:3001';

export const getServerUrl = (): string => {
  // Holt die URL aus dem Speicher oder nimmt den Standard
  let url = localStorage.getItem('clover_server_url') || DEFAULT_SERVER;
  // Entfernt Slash am Ende, falls der User "example.com/" eingibt
  return url.replace(/\/$/, "");
};

export const setServerUrl = (url: string) => {
  localStorage.setItem('clover_server_url', url);
};