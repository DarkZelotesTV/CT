import { useMemo, useState } from 'react';
import { Loader2, Hash, Volume2, Globe, Lock, ListChecks, GripHorizontal } from 'lucide-react';
import { apiFetch } from '../../api/http';
import classNames from 'classnames';
import { ServerTheme, defaultServerTheme, resolveServerTheme } from '../../theme/serverTheme';
import { ModalLayout } from './ModalLayout';
import { Badge, Input } from '../ui';

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
          <label className="flex items-center gap-2 text-xs font-bold uppercase text-[color:var(--color-text-muted)]">
            Kanaltyp
            <Badge variant="accent">Neu</Badge>
          </label>

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
                    'flex items-center p-3 rounded-lg cursor-pointer border transition-all bg-[color:var(--color-surface-hover)] border-[color:var(--color-border)] hover:border-[var(--color-accent-hover)] hover:bg-white/[0.08] text-white',
                    isActive
                      && 'border-[var(--color-accent)] bg-[color:var(--color-accent)]/10 shadow-[0_0_15px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]'
                  )}
                  style={{ color: palette.text }}
                >
                  <Icon size={20} className="mr-3 text-[color:var(--color-text-muted)] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{label}</div>
                    <div className="text-[11px] text-[color:var(--color-text-muted)] truncate">{description}</div>
                  </div>
                  <div
                    className={classNames(
                      'w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ml-2',
                      isActive
                        ? 'border-[var(--color-accent)] bg-[color:var(--color-accent)]/20'
                        : 'border-[color:var(--color-border-strong)]'
                    )}
                  >
                    {isActive && <div className="w-2 h-2 rounded-full bg-[color:var(--color-accent)]" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Name Input */}
        <div>
          <label className="text-xs font-bold uppercase mb-2 block text-[color:var(--color-text-muted)]">Kanalname</label>
          <div className="flex items-center px-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/60 focus-within:border-[var(--color-focus)] text-white transition-colors">
            {type === 'text' ? (
              <Hash size={16} className="mr-2 text-[color:var(--color-text-muted)]" />
            ) : type === 'voice' ? (
              <Volume2 size={16} className="mr-2 text-[color:var(--color-text-muted)]" />
            ) : type === 'web' ? (
              <Globe size={16} className="mr-2 text-[color:var(--color-text-muted)]" />
            ) : type === 'data-transfer' ? (
              <Lock size={16} className="mr-2 text-[color:var(--color-text-muted)]" />
            ) : type === 'list' ? (
              <ListChecks size={16} className="mr-2 text-[color:var(--color-text-muted)]" />
            ) : (
              <GripHorizontal size={16} className="mr-2 text-[color:var(--color-text-muted)]" />
            )}
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="neuer-kanal"
              className="w-full bg-transparent py-2.5 outline-none font-medium no-drag placeholder:text-[color:var(--color-text-muted)]"
            />
          </div>
        </div>

        {/* Passwort Felder - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold uppercase mb-2 block text-[color:var(--color-text-muted)]">Standard Passwort</label>
            <Input
              type="text"
              value={defaultPassword}
              onChange={(e) => setDefaultPassword(e.target.value)}
              className="bg-[color:var(--color-surface)]/60 text-white focus-visible:border-[color:var(--color-focus)] focus-visible:ring-[color:var(--color-focus)]/50"
              placeholder={type === 'spacer' ? 'Nicht nötig' : 'Optional'}
              disabled={type === 'spacer'}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase mb-2 block text-[color:var(--color-text-muted)]">Beitritts Passwort</label>
            <Input
              type="text"
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value)}
              className="bg-[color:var(--color-surface)]/60 text-white focus-visible:border-[color:var(--color-focus)] focus-visible:ring-[color:var(--color-focus)]/50"
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
            className="text-sm font-medium px-4 py-2 rounded hover:bg-[color:var(--color-surface-hover)] transition-colors text-[color:var(--color-text)] hover:text-white"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading || !name}
            className="px-6 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95 text-white text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-hover)] focus-visible:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
            style={
              {
                '--accent': palette.accent,
                '--accent-hover': palette.accentHover,
              } as React.CSSProperties
            }
          >
            {loading && <Loader2 className="animate-spin" size={16} />}
            Kanal erstellen
          </button>
        </div>
      </form>
    </ModalLayout>
  );
};
