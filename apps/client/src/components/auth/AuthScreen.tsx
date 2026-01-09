import { useState, useEffect } from 'react';
import axios from 'axios';
import { Mail, Lock, User, Loader2, ArrowRight, Clover, Server, CheckCircle2, RefreshCw } from 'lucide-react';
import { getAllowInsecureHttp, getDefaultServerUrl, getServerPassword, getServerUrl, normalizeServerUrlString, resetServerSettings, setAllowInsecureHttp, setServerPassword, setServerUrl } from '../../utils/apiConfig';
import { Button, IconButton } from '../ui/Button';
import { Input } from '../ui/Input';
import { Toggle } from '../ui/Toggle';

interface AuthScreenProps {
  onLoginSuccess: (token: string, userData: any) => void;
}

export const AuthScreen = ({ onLoginSuccess }: AuthScreenProps) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  // Server Settings State
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [serverAddress, setServerAddress] = useState(() => getServerUrl());
  const [serverPassword, setServerPasswordState] = useState(() => getServerPassword());
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [allowInsecureHttp, setAllowHttp] = useState(() => getAllowInsecureHttp());

  // Beim Start: Gespeicherte Server-URL laden
  useEffect(() => {
    setServerAddress(getServerUrl());
    setServerPasswordState(getServerPassword());
    setAllowHttp(getAllowInsecureHttp());
  }, []);

  // Server-Verbindung testen (Ping)
  const checkServerConnection = async (url: string) => {
    setConnectionStatus('checking');
    const normalized = normalizeServerUrlString(url, { allowInsecure: allowInsecureHttp });
    setServerAddress(normalized);
    try {
      // Wir pingen den Auth-Endpunkt an (ohne Daten), nur um zu sehen ob er da ist
      // Oder wir rufen einfach Root auf, falls es eine Route gibt. 
      // Hier nutzen wir einen Timeout, damit es nicht ewig lädt.
      await axios.get(`${normalized}/api/auth/ping`, { timeout: 2000 }).catch(() => {
         // 404 ist okay, heißt Server antwortet. Network Error ist schlecht.
         return true; 
      });
      setConnectionStatus('ok');
      setServerUrl(normalized); // Speichern, wenn erfolgreich
      setServerPassword(serverPassword);
    } catch (err) {
      setConnectionStatus('error');
    }
  };

  const handleRestoreServerSettings = () => {
    resetServerSettings();
    setAllowHttp(false);
    setAllowInsecureHttp(false);
    setServerAddress(getDefaultServerUrl());
    setServerPasswordState('');
    setConnectionStatus('idle');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const normalizedServerUrl = normalizeServerUrlString(serverAddress, { allowInsecure: allowInsecureHttp });
    setServerAddress(normalizedServerUrl);
    setServerUrl(normalizedServerUrl);

    // WICHTIG: Wir nutzen jetzt die dynamische Server-Adresse!
    const baseUrl = normalizedServerUrl;
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegistering 
      ? { email, password, username } 
      : { email, password };

    try {
      setServerUrl(serverAddress);
      setServerPassword(serverPassword);
      const res = await axios.post(`${baseUrl}${endpoint}`, payload);
      
      if (isRegistering) {
        setIsRegistering(false);
        setError('');
        alert("Account erstellt auf " + baseUrl);
      } else {
        const { token, user } = res.data;
        onLoginSuccess(token, user);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "ERR_NETWORK") {
         setError(`Server nicht erreichbar unter ${baseUrl}. Bitte Adresse prüfen.`);
         setShowServerSettings(true); // Einstellungen automatisch öffnen
      } else {
         setError(err.response?.data?.error || "Ein Fehler ist aufgetreten");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[color:var(--color-background)] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-green-500/20 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>

      {/* Glass Card */}
      <div className="relative z-10 w-full max-w-md bg-[color:var(--color-surface-hover)] backdrop-blur-xl border border-[color:var(--color-border)] rounded-2xl shadow-2xl p-8 animate-in fade-in zoom-in duration-500 transition-all">
        
        {/* SERVER SETTINGS TOGGLE (Oben Rechts) */}
        <IconButton 
            onClick={() => setShowServerSettings(!showServerSettings)}
            variant="ghost"
            className="absolute top-4 right-4 p-2 text-[color:var(--color-text-muted)] hover:text-text hover:bg-[color:var(--color-surface-hover)]/80 rounded-lg transition-colors"
            title="Server Einstellungen"
        >
            <Server size={20} className={connectionStatus === 'error' ? 'text-red-500' : ''} />
        </IconButton>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg mb-4 transform rotate-3 hover:rotate-6 transition-transform">
            <Clover className="text-text" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-text tracking-tight">CloverTalk</h1>
          <p className="text-[color:var(--color-text-muted)] mt-2 text-sm">
            {isRegistering ? 'Erstelle deinen Zugang' : 'Willkommen zurück'}
          </p>
        </div>

        {/* SERVER SETTINGS BEREICH (Collapsible) */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showServerSettings ? 'max-h-80 mb-6 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="bg-[color:var(--color-surface)]/60 rounded-xl p-4 border border-[color:var(--color-border)] space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <label className="text-xs font-bold text-[color:var(--color-text-muted)] uppercase block">
                    Server Adresse
                    <div className="text-[10px] text-[color:var(--color-text-muted)] font-normal normal-case mt-1">Hoste deinen eigenen CloverTalk Server und verbinde dich hier.</div>
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    {connectionStatus === 'ok' && <span className="text-green-400 flex items-center gap-1"><CheckCircle2 size={12}/> Online</span>}
                    {connectionStatus === 'error' && <span className="text-red-400">Offline</span>}
                    <Button
                      type="button"
                      onClick={handleRestoreServerSettings}
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[color:var(--color-surface-hover)] hover:bg-[color:var(--color-surface-hover)]/80 text-[color:var(--color-text)]"
                    >
                      <RefreshCw size={12} /> Zurücksetzen
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                    <Input
                        type="text"
                        value={serverAddress}
                        onChange={(e) => setServerAddress(e.target.value)}
                        onBlur={() => {
                          const normalized = normalizeServerUrlString(serverAddress, { allowInsecure: allowInsecureHttp });
                          setServerAddress(normalized);
                          setServerUrl(normalized);
                          checkServerConnection(normalized);
                        }}
                        className="flex-1 bg-[color:var(--color-surface)]/50 rounded-lg px-3 py-2 text-sm text-text"
                        placeholder="https://localhost:3001"
                    />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[color:var(--color-text-muted)]">
                  <Toggle
                    id="allow-http-auth"
                    size="sm"
                    className="bg-[color:var(--color-surface)]/70"
                    checked={allowInsecureHttp}
                    onChange={(e) => {
                      const allow = e.target.checked;
                      setAllowHttp(allow);
                      setAllowInsecureHttp(allow);
                      const normalized = normalizeServerUrlString(serverAddress, { allowInsecure: allow });
                      setServerAddress(normalized);
                      setServerUrl(normalized);
                    }}
                  />
                  <label htmlFor="allow-http-auth" className="cursor-pointer">
                    Unsichere <code className="text-[color:var(--color-text)]">http://</code>-Verbindungen erlauben (nur Entwicklung)
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[color:var(--color-text-muted)] uppercase block">Server Passwort (optional)</label>
                  <Input
                    type="password"
                    value={serverPassword}
                    onChange={(e) => setServerPasswordState(e.target.value)}
                    onBlur={() => setServerPassword(serverPassword)}
                    className="w-full bg-[color:var(--color-surface)]/50 rounded-lg px-3 py-2 text-sm text-text"
                    placeholder="Leer lassen wenn keins"
                  />
                  <p className="text-[10px] text-[color:var(--color-text-muted)]">Für private Installationen kannst du hier das Server-Passwort hinterlegen.</p>
                </div>
            </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-200 text-sm p-3 rounded-lg mb-6 text-center animate-in slide-in-from-top-2">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {isRegistering && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-[color:var(--color-text)] ml-1">Benutzername</label>
              <div className="relative group">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="text-[color:var(--color-text-muted)] group-focus-within:text-[color:var(--color-accent)] transition-colors" size={18} />
                 </div>
                 <Input 
                    type="text" 
                    required={isRegistering}
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 bg-[color:var(--color-surface)]/50 rounded-xl text-text placeholder:text-[color:var(--color-text-muted)] transition-all sm:text-sm"
                    placeholder="Dein Name"
                 />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-[color:var(--color-text)] ml-1">Email Adresse</label>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="text-[color:var(--color-text-muted)] group-focus-within:text-[color:var(--color-accent)] transition-colors" size={18} />
                </div>
                <Input 
                  type="email" 
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-[color:var(--color-surface)]/50 rounded-xl text-text placeholder:text-[color:var(--color-text-muted)] transition-all sm:text-sm"
                  placeholder="name@beispiel.de"
                />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[color:var(--color-text)] ml-1">Passwort</label>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="text-[color:var(--color-text-muted)] group-focus-within:text-[color:var(--color-accent)] transition-colors" size={18} />
                </div>
                <Input 
                  type="password" 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-[color:var(--color-surface)]/50 rounded-xl text-text placeholder:text-[color:var(--color-text-muted)] transition-all sm:text-sm"
                  placeholder="••••••••"
                />
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full relative overflow-hidden group bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-text font-bold py-3.5 rounded-xl shadow-lg shadow-green-900/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="relative z-10 flex items-center justify-center gap-2">
               {loading ? <Loader2 className="animate-spin" /> : (isRegistering ? 'Starten' : 'Anmelden')}
               {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
            </div>
            <div className="absolute inset-0 h-full w-full scale-0 rounded-xl transition-all duration-300 group-hover:scale-100 group-hover:bg-[color:var(--color-surface-hover)]/80"></div>
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-[color:var(--color-border)] text-center">
          <p className="text-sm text-[color:var(--color-text-muted)]">
            {isRegistering ? 'Bereits registriert?' : 'Noch keinen Account?'}
          </p>
          <Button 
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            variant="ghost"
            size="sm"
            className="mt-2 text-green-400 hover:text-green-300 font-medium text-sm transition-colors hover:underline"
          >
            {isRegistering ? 'Hier anmelden' : 'Kostenlos registrieren'}
          </Button>
        </div>

      </div>

      <div className="absolute bottom-4 text-center w-full text-[color:var(--color-text-muted)] text-xs">
         Host: {serverAddress} &copy; 2024 CloverTalk.
      </div>
    </div>
  );
};
