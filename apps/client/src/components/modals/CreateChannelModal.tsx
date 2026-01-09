import { useMemo, useState } from 'react';
import { Loader2, Hash, Volume2, Globe, Lock, ListChecks, GripHorizontal } from 'lucide-react';
import { apiFetch } from '../../api/http';
import classNames from 'classnames';
import { ServerTheme, defaultServerTheme, resolveServerTheme } from '../../theme/serverTheme';
import { ModalLayout } from './ModalLayout';
import { Badge, Icon, Input } from '../ui';
import { Button } from '../ui/Button';

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
  const labelClassName = 'text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]';

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
          <label className={`flex items-center gap-2 ${labelClassName}`}>
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
            ].map(({ key, label, description, Icon: ChannelIcon }) => {
              const isActive = type === key;
              return (
                <Button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  className={classNames(
                    'flex items-center p-3 rounded-[var(--radius-3)] cursor-pointer border transition-all bg-[color:var(--color-surface-hover)] border-[color:var(--color-border)] hover:border-[var(--color-accent-hover)] hover:bg-[color:var(--color-surface-hover)] text-text',
                    isActive
                      && 'border-[var(--color-accent)] bg-[color:var(--color-accent)]/10 shadow-[0_0_15px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]'
                  )}
                  style={{ color: palette.text }}
                >
                  <Icon icon={ChannelIcon} size="lg" tone="muted" className="mr-3 flex-shrink-0" />
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
                </Button>
              );
            })}
          </div>
        </div>

        {/* Name Input */}
        <div>
          <label className={`mb-2 block ${labelClassName}`}>Kanalname</label>
          <div className="flex items-center px-3 rounded-[var(--radius-3)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/60 focus-within:border-[var(--color-focus)] focus-within:ring-2 focus-within:ring-[color:var(--color-focus)] focus-within:ring-offset-2 focus-within:ring-offset-background text-text transition-colors">
            {type === 'text' ? (
              <Icon icon={Hash} size="md" tone="muted" className="mr-2" />
            ) : type === 'voice' ? (
              <Icon icon={Volume2} size="md" tone="muted" className="mr-2" />
            ) : type === 'web' ? (
              <Icon icon={Globe} size="md" tone="muted" className="mr-2" />
            ) : type === 'data-transfer' ? (
              <Icon icon={Lock} size="md" tone="muted" className="mr-2" />
            ) : type === 'list' ? (
              <Icon icon={ListChecks} size="md" tone="muted" className="mr-2" />
            ) : (
              <Icon icon={GripHorizontal} size="md" tone="muted" className="mr-2" />
            )}
            <Input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="neuer-kanal"
              className="w-full border-0 bg-transparent py-2.5 font-medium no-drag focus-visible:ring-0 focus-visible:border-transparent focus-visible:ring-offset-0"
            />
          </div>
        </div>

        {/* Passwort Felder - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={`mb-2 block ${labelClassName}`}>Standard Passwort</label>
            <Input
              type="text"
              value={defaultPassword}
              onChange={(e) => setDefaultPassword(e.target.value)}
              inputSize="md"
              placeholder={type === 'spacer' ? 'Nicht nötig' : 'Optional'}
              disabled={type === 'spacer'}
            />
          </div>
          <div>
            <label className={`mb-2 block ${labelClassName}`}>Beitritts Passwort</label>
            <Input
              type="text"
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value)}
              inputSize="md"
              placeholder={type === 'spacer' ? 'Nicht nötig' : 'Optional'}
              disabled={type === 'spacer'}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center pt-2 gap-2">
          <Button
            type="button"
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="font-medium"
          >
            Abbrechen
          </Button>
          <Button
            type="submit"
            disabled={loading || !name}
            variant="primary"
            size="md"
            className="font-semibold shadow-lg disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95"
            style={
              {
                '--color-accent': palette.accent,
                '--color-accent-hover': palette.accentHover,
              } as React.CSSProperties
            }
          >
            {loading && <Icon icon={Loader2} size="md" tone="default" className="text-inherit animate-spin" />}
            Kanal erstellen
          </Button>
        </div>
      </form>
    </ModalLayout>
  );
};
