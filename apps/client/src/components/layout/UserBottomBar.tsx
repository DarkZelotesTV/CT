import { useMemo, useState } from 'react';
import { Mic, Headphones, Settings, Shield } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { UserSettingsModal } from '../modals/UserSettingsModal';
import { TalkSettingsModal } from '../modals/TalkSettingsModal';
import { IdentityModal } from '../modals/IdentityModal';
import { useVoice } from '../../context/voice-state';

export const UserBottomBar = () => {
  const { settings } = useSettings();
  const user = useMemo(() => JSON.parse(localStorage.getItem('clover_user') || '{}'), []);
  const [showSettings, setShowSettings] = useState(false);
  const [showTalkSettings, setShowTalkSettings] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);

  const { muted, setMuted } = useVoice();

  const displayName = settings.profile.displayName || user.username || 'Trooper';
  const avatarUrl = settings.profile.avatarUrl || user.avatar_url;

  return (
    <>
      <div className="p-3 bg-[#0a0a0a] flex items-center gap-3">
        <div className="w-8 h-8 bg-cyan-700/20 border border-cyan-500/50 rounded flex items-center justify-center text-cyan-400 font-bold text-xs relative overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} className="w-full h-full object-cover" />
          ) : (
            displayName.substring(0, 1).toUpperCase()
          )}
          <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-black animate-pulse"></div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="text-xs font-bold text-gray-300 truncate tracking-wider">{displayName}</div>
          <div className="text-[9px] text-cyan-600 uppercase tracking-widest">ID: {user.id || '7567'}</div>
        </div>

        <div className="flex gap-1">
          <button
            className={`p-1 rounded ${muted ? 'text-red-400 hover:text-red-300 bg-red-500/10' : 'text-gray-500 hover:text-cyan-400 hover:bg-cyan-900/30'}`}
            onClick={() => setMuted(!muted)}
            title={muted ? 'Mikrofon aktivieren' : 'Mikrofon stummschalten'}
          >
            <Mic size={14} />
          </button>
          <button
            className="p-1 hover:bg-cyan-900/30 rounded text-gray-500 hover:text-cyan-400"
            onClick={() => setShowTalkSettings(true)}
            title="Talk Settings"
          >
            <Headphones size={14} />
          </button>
          <button
            className="p-1 hover:bg-cyan-900/30 rounded text-gray-500 hover:text-cyan-400"
            onClick={() => setShowIdentity(true)}
            title="Identität"
          >
            <Shield size={14} />
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
      {showTalkSettings && <TalkSettingsModal onClose={() => setShowTalkSettings(false)} />}
      {showIdentity && (
        <IdentityModal
          onClose={() => setShowIdentity(false)}
          onIdentityChanged={() => {}}
        />
      )}
    </>
  );
};
