import { useMemo, useState } from 'react';
import { Headphones, MicOff, Settings } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { UserSettingsModal } from '../modals/UserSettingsModal';
import { useVoice } from '../../features/voice';
import { useSocket } from '../../context/SocketContext';
import { storage } from '../../shared/config/storage';

export const UserBottomBar = () => {
  const { settings } = useSettings();
  const user = useMemo(() => storage.get('cloverUser'), []);
  const [showSettings, setShowSettings] = useState(false);

  const { muted, micMuted, setMuted, setMicMuted } = useVoice();
  // NEU: Echter Verbindungsstatus vom Socket
  const { isConnected } = useSocket();

  // Priorisierung: Lokale Einstellung > Server DisplayName > Server Username > Fallback
  const displayName = settings.profile.displayName || user.displayName || user.username || 'Trooper';
  // Priorisierung: Lokale Einstellung > Server Avatar
  const avatarUrl = settings.profile.avatarUrl || user.avatar_url;

  // NEU: Statusfarbe basierend auf Socket-Verbindung
  const statusColor = isConnected ? 'bg-green-500' : 'bg-red-500';
  const statusText = isConnected ? 'Online' : 'Verbindung getrennt';

  return (
    <>
      <div className="p-3 bg-[#0a0a0a] flex items-center gap-3">
        <div className="w-8 h-8 bg-cyan-700/20 border border-cyan-500/50 rounded flex items-center justify-center text-cyan-400 font-bold text-xs relative overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} className="w-full h-full object-cover" alt="User Avatar" />
          ) : (
            displayName.substring(0, 1).toUpperCase()
          )}
          {/* NEU: Dynamischer Status-Indikator */}
          <div 
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 ${statusColor} rounded-full border border-black animate-pulse`}
            title={statusText}
          ></div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="text-xs font-bold text-gray-300 truncate tracking-wider">{displayName}</div>
          <div className="text-[9px] text-cyan-600 uppercase tracking-widest">ID: {user.id || 'Unknown'}</div>
        </div>

        <div className="flex gap-1">
          <button
            className={`p-1 rounded ${micMuted ? 'text-red-400 hover:text-red-300 bg-red-500/10' : 'text-gray-500 hover:text-cyan-400 hover:bg-cyan-900/30'}`}
            onClick={() => setMicMuted(!micMuted)}
            title={micMuted ? 'Mikrofon wieder aktivieren' : 'Nur Mikrofon stummschalten'}
          >
            <MicOff size={14} />
          </button>
          <button
            className={`p-1 rounded ${muted ? 'text-red-400 hover:text-red-300 bg-red-500/10' : 'text-gray-500 hover:text-cyan-400 hover:bg-cyan-900/30'}`}
            onClick={() => setMuted(!muted)}
            title={muted ? 'Audio und Mikrofon wieder aktivieren' : 'Alle Ein- und Ausgänge stummschalten'}
          >
            <Headphones size={14} />
          </button>
          <button
            className="p-1 hover:bg-cyan-900/30 rounded text-gray-500 hover:text-cyan-400"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
};