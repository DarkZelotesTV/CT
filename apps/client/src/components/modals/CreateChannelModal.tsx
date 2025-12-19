import { useMemo, useState } from 'react';
import { Loader2, Hash, Volume2, Globe, Lock, ListChecks, GripHorizontal } from 'lucide-react';
import { apiFetch } from '../../api/http';
import classNames from 'classnames';
import { ServerTheme, defaultServerTheme, resolveServerTheme } from '../../theme/serverTheme';
import { ModalLayout } from './ModalLayout';

interface CreateChannelModalProps {
  serverId: number;
  categoryId?: number | null;
  defaultType?: 'text' | 'voice' | 'web' | 'data-transfer' | 'spacer' | 'list';
  theme?: Partial<ServerTheme> | null;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateChannelModal = ({
  serverId,
  categoryId = null,
  defaultType = 'text',
  theme,
  onClose,
  onCreated,
}: CreateChannelModalProps) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'voice' | 'web' | 'data-transfer' | 'spacer' | 'list'>(defaultType);
  const [loading, setLoading] = useState(false);
  const [defaultPassword, setDefaultPassword] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  const palette = useMemo(() => resolveServerTheme(theme ?? defaultServerTheme), [theme]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await apiFetch(`/api/servers/${serverId}/channels`, {
        method: 'POST',
        body: JSON.stringify({ name, type, categoryId, defaultPassword, joinPassword })
      });

      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Fehler beim Erstellen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalLayout
      title="Kanal erstellen"
      onClose={onClose}
      onOverlayClick={onClose}
      description="Lege einen neuen Bereich für deinen Server an."
      bodyClassName="p-6 pt-2 space-y-6"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Typ Auswahl - Responsive Grid: Mobile 1 Spalte, Tablet+ 2 Spalten */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-gray-400">Kanaltyp</label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { key: 'text' as const, label: 'Text', description: 'Chat & Bilder', Icon: Hash },
              { key: 'voice' as const, label: 'Sprache', description: 'Talk & Stream', Icon: Volume2 },
              { key: 'web' as const, label: 'Webseite', description: 'Embedded Web', Icon: Globe },
              { key: 'list' as const, label: 'Liste', description: 'To-Do / Drag', Icon: ListChecks },
              { key: 'data-transfer' as const, label: 'Daten', description: 'Encrypted Safe', Icon: Lock },
              { key: 'spacer' as const, label: 'Trenner', description: 'Nur Visuell', Icon: GripHorizontal },
            ].map(({ key, label, description, Icon }) => {
              const isActive = type === key;
              return (
                <div
                  key={key}
                  onClick={() => setType(key)}
                  className={classNames(
                    'flex items-center p-3 rounded-lg cursor-pointer border transition-all bg-white/5 border-white/10 hover:border-indigo-500 hover:bg-white/[0.08] text-white',
                    isActive && 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                  )}
                  style={{ color: palette.text }}
                >
                  <Icon size={20} className="mr-3 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{label}</div>
                    <div className="text-[11px] text-gray-400 truncate">{description}</div>
                  </div>
                  <div
                    className={classNames(
                      'w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ml-2',
                      isActive ? 'border-indigo-500 bg-indigo-500/20' : 'border-white/20'
                    )}
                  >
                    {isActive && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Name Input */}
        <div>
          <label className="text-xs font-bold uppercase mb-2 block text-gray-400">Kanalname</label>
          <div className="flex items-center px-3 rounded-lg border border-white/10 bg-black/30 focus-within:border-indigo-500 text-white transition-colors">
            {type === 'text' ? (
              <Hash size={16} className="mr-2 text-gray-400" />
            ) : type === 'voice' ? (
              <Volume2 size={16} className="mr-2 text-gray-400" />
            ) : type === 'web' ? (
              <Globe size={16} className="mr-2 text-gray-400" />
            ) : type === 'data-transfer' ? (
              <Lock size={16} className="mr-2 text-gray-400" />
            ) : type === 'list' ? (
              <ListChecks size={16} className="mr-2 text-gray-400" />
            ) : (
              <GripHorizontal size={16} className="mr-2 text-gray-400" />
            )}
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="neuer-kanal"
              className="w-full bg-transparent py-2.5 outline-none font-medium no-drag placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* Passwort Felder - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold uppercase mb-2 block text-gray-400">Standard Passwort</label>
            <input
              type="text"
              value={defaultPassword}
              onChange={(e) => setDefaultPassword(e.target.value)}
              className="w-full rounded-xl px-3 py-2 outline-none bg-black/30 border border-white/10 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all placeholder:text-gray-600 text-sm"
              placeholder={type === 'spacer' ? 'Nicht nötig' : 'Optional'}
              disabled={type === 'spacer'}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase mb-2 block text-gray-400">Beitritts Passwort</label>
            <input
              type="text"
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value)}
              className="w-full rounded-xl px-3 py-2 outline-none bg-black/30 border border-white/10 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all placeholder:text-gray-600 text-sm"
              placeholder={type === 'spacer' ? 'Nicht nötig' : 'Optional'}
              disabled={type === 'spacer'}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center pt-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium px-4 py-2 rounded hover:bg-white/5 transition-colors text-gray-300 hover:text-white"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading || !name}
            className="px-6 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95 text-white text-sm"
            style={{ background: palette.accent }}
            onMouseEnter={(e) => (e.currentTarget.style.background = palette.accentHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = palette.accent)}
          >
            {loading && <Loader2 className="animate-spin" size={16} />}
            Kanal erstellen
          </button>
        </div>
      </form>
    </ModalLayout>
  );
};