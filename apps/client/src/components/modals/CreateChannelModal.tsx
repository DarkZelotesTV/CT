import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Hash, Volume2, Globe } from 'lucide-react';
import { apiFetch } from '../../api/http';
import classNames from 'classnames';
import { ServerTheme, defaultServerTheme, resolveServerTheme } from '../../theme/serverTheme';

interface CreateChannelModalProps {
  serverId: number;
  categoryId?: number | null;
  defaultType?: 'text' | 'voice' | 'web';
  theme?: Partial<ServerTheme> | null;
  portalTarget?: HTMLElement | null;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateChannelModal = ({
  serverId,
  categoryId = null,
  defaultType = 'text',
  theme,
  portalTarget,
  onClose,
  onCreated,
}: CreateChannelModalProps) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'voice' | 'web'>(defaultType);
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

  const portalNode = portalTarget ?? (typeof document !== 'undefined' ? document.body : null);
  if (!portalNode) return null;

  const positionClass = portalTarget ? 'absolute' : 'fixed';

  const modal = (
    <div
      className={`${positionClass} inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-200`}
      style={{ backgroundColor: palette.overlay }}
    >
      <div
        className="w-full max-w-md rounded-lg shadow-2xl border overflow-hidden transform scale-100 no-drag"
        style={{ background: palette.surfaceAlt, borderColor: palette.border }}
      >
        {/* Header */}
        <div className="p-6 pb-2 flex justify-between items-center" style={{ color: palette.text }}>
          <h2 className="text-xl font-bold uppercase tracking-wide">Kanal erstellen</h2>
          <button onClick={onClose} className="transition-colors" style={{ color: palette.textMuted }}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Typ Auswahl */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase" style={{ color: palette.textMuted }}>
              Kanaltyp
            </label>

            {[
              { key: 'text' as const, label: 'Text', description: 'Nachrichten, Bilder, Emojis senden.', Icon: Hash },
              { key: 'voice' as const, label: 'Sprache', description: 'Zusammen abhängen, reden, streamen.', Icon: Volume2 },
              { key: 'web' as const, label: 'Webseite', description: 'Eine HTML Startseite für deinen Server.', Icon: Globe },
            ].map(({ key, label, description, Icon }) => {
              const isActive = type === key;
              return (
                <div
                  key={key}
                  onClick={() => setType(key)}
                  className={classNames('flex items-center p-3 rounded cursor-pointer border transition-colors')}
                  style={{
                    background: isActive ? palette.surface : palette.background,
                    borderColor: isActive ? palette.borderStrong : palette.border,
                    color: palette.text,
                  }}
                >
                  <Icon size={24} className="mr-3" style={{ color: palette.textMuted }} />
                  <div className="flex-1">
                    <div className="font-bold" style={{ color: palette.text }}>
                      {label}
                    </div>
                    <div className="text-xs" style={{ color: palette.textMuted }}>
                      {description}
                    </div>
                  </div>
                  <div
                    className={classNames('w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors')}
                    style={{ borderColor: isActive ? palette.text : palette.border }}
                  >
                    {isActive && <div className="w-2.5 h-2.5 rounded-full" style={{ background: palette.text }} />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Name Input */}
          <div>
            <label className="text-xs font-bold uppercase mb-2 block" style={{ color: palette.textMuted }}>
              Kanalname
            </label>
            <div
              className="flex items-center px-3 rounded border border-transparent focus-within:border"
              style={{
                background: palette.surface,
                borderColor: palette.border,
                color: palette.text,
                outlineColor: palette.accent,
              }}
            >
              {type === 'text' ? (
                <Hash size={16} className="mr-2" style={{ color: palette.textMuted }} />
              ) : type === 'voice' ? (
                <Volume2 size={16} className="mr-2" style={{ color: palette.textMuted }} />
              ) : (
                <Globe size={16} className="mr-2" style={{ color: palette.textMuted }} />
              )}
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="neuer-kanal"
                className="w-full bg-transparent py-2.5 outline-none font-medium no-drag"
                style={{ color: palette.text }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase mb-2 block" style={{ color: palette.textMuted }}>
                Standard Passwort
              </label>
              <input
                type="text"
                value={defaultPassword}
                onChange={(e) => setDefaultPassword(e.target.value)}
                className="w-full rounded-xl px-3 py-2 outline-none"
                style={{
                  background: palette.surface,
                  border: `1px solid ${palette.border}`,
                  color: palette.text,
                }}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase mb-2 block" style={{ color: palette.textMuted }}>
                Beitritts Passwort
              </label>
              <input
                type="text"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                className="w-full rounded-xl px-3 py-2 outline-none"
                style={{
                  background: palette.surface,
                  border: `1px solid ${palette.border}`,
                  color: palette.text,
                }}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end items-center pt-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium px-6 transition-colors"
              style={{ color: palette.text }}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading || !name}
              className="px-6 py-2 rounded font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
              style={{
                background: palette.accent,
                color: palette.text,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = palette.accentHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = palette.accent)}
            >
              {loading && <Loader2 className="animate-spin" size={16} />}
              Kanal erstellen
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, portalNode);
};