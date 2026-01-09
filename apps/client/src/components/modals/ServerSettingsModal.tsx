import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertTriangle, Image as ImageIcon, Loader2, Shield, Trash2 } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { ModalLayout } from './ModalLayout';
import { ErrorCard, Icon, Input, Select, Spinner, Toggle } from '../ui';
import { Button } from '../ui/Button';
import { getServerUrl } from '../../utils/apiConfig';

interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice' | 'web' | 'data-transfer' | 'spacer' | 'list';
}

interface Category {
  id: number;
  name: string;
  channels: Channel[];
}

interface ServerSettingsModalProps {
  serverId: number;
  onClose: () => void;
  onUpdated: (data: { name: string; fallbackChannelId: number | null }) => void;
  onDeleted: () => void;
}

interface StructureResponse {
  categories: Category[];
  uncategorized: Channel[];
  fallbackChannelId?: number | null;
}

export const ServerSettingsModal = ({ serverId, onClose, onUpdated, onDeleted }: ServerSettingsModalProps) => {
  const [name, setName] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [fallbackChannelId, setFallbackChannelId] = useState<number | null>(null);
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dragAndDropEnabled, setDragAndDropEnabled] = useState(true);
  const labelClassName = 'text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]';
  const helperClassName = 'text-xs text-[color:var(--color-text-muted)]';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const servers = await apiFetch<any[]>('/api/servers');
      const current = servers.find((s) => s.id === serverId);
      if (!current) {
        throw new Error('Server nicht gefunden.');
      }
      setName(current.name ?? '');
      setIconUrl(current.icon_url ?? current.iconUrl ?? '');
      setIconFile(null);
      setIconPreview(null);
      setRemoveIcon(false);
      setDragAndDropEnabled(current.drag_drop_enabled ?? current.dragAndDropEnabled ?? true);

      const struct = await apiFetch<StructureResponse>(`/api/servers/${serverId}/structure`);
      const allChannels = [...struct.uncategorized, ...struct.categories.flatMap((c) => c.channels)];
      const selectable = allChannels.filter((c) => c.type !== 'voice' && c.type !== 'spacer');
      setChannels(selectable);

      const validFallback = selectable.find((c) => c.id === (struct.fallbackChannelId ?? null));
      setFallbackChannelId(validFallback ? validFallback.id : selectable[0]?.id ?? null);
    } catch (err: any) {
      console.error('Failed to load server settings', err);
      setError(err?.response?.data?.error || err?.message || 'Fehler beim Laden der Serverdaten.');
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const channelOptions = useMemo(() => channels, [channels]);

  const resolveIconUrl = useCallback((value?: string | null) => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    const normalized = value.startsWith('/') ? value : `/${value}`;
    return `${getServerUrl()}${normalized}`;
  }, []);

  const previewUrl = iconPreview || resolveIconUrl(iconUrl);

  const handleIconChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setIconError(null);
    setRemoveIcon(false);

    if (!file) {
      setIconFile(null);
      setIconPreview(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setIconError('Bitte eine Bilddatei auswählen.');
      return;
    }

    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setIconError('Das Icon darf maximal 2 MB groß sein.');
      return;
    }

    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const handleRemoveIcon = () => {
    setIconFile(null);
    setIconPreview(null);
    setIconError(null);
    setRemoveIcon(true);
    setIconUrl('');
  };

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) {
      setActionError('Bitte einen Servernamen eingeben.');
      return;
    }

    setIsSaving(true);
    setActionError(null);
    try {
      let nextIconPath: string | null | undefined = undefined;

      if (iconFile) {
        setIsUploadingIcon(true);
        const formData = new FormData();
        formData.append('icon', iconFile);
        const uploadResult = await apiFetch<{ iconUrl: string }>(`/api/servers/${serverId}/icon`, {
          method: 'POST',
          body: formData,
        });
        nextIconPath = uploadResult.iconUrl;
        setIconUrl(uploadResult.iconUrl);
        setIconPreview(null);
        setIconFile(null);
      } else if (removeIcon) {
        nextIconPath = null;
      }

      await apiFetch(`/api/servers/${serverId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          fallbackChannelId: fallbackChannelId ?? null,
          dragAndDropEnabled,
          ...(typeof nextIconPath !== 'undefined' ? { iconPath: nextIconPath } : {}),
        }),
      });
      onUpdated({ name: name.trim(), fallbackChannelId: fallbackChannelId ?? null });
      onClose();
    } catch (err: any) {
      console.error('Failed to update server', err);
      setActionError(err?.response?.data?.error || err?.message || 'Aktualisierung fehlgeschlagen.');
    } finally {
      setIsSaving(false);
      setIsUploadingIcon(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    const confirmed = window.confirm(
      'Bist du sicher, dass du diesen Server dauerhaft löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.'
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await apiFetch(`/api/servers/${serverId}`, { method: 'DELETE' });
      onDeleted();
      onClose();
    } catch (err: any) {
      console.error('Failed to delete server', err);
      setDeleteError(err?.response?.data?.error || err?.message || 'Löschen fehlgeschlagen.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalLayout
      title="Server Einstellungen"
      description="Verwalte den Servernamen, Fallback-Kanal und weitere Optionen."
      onClose={onClose}
      onOverlayClick={onClose}
      bodyClassName="p-6 space-y-4"
      footer={
        !isLoading && !error ? (
          <div className="flex justify-between items-center gap-3">
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-text-muted hover:text-text text-sm font-medium px-3 py-2 rounded-[var(--radius-3)] hover:bg-[color:var(--color-surface-hover)]"
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              variant="primary"
              className="px-5 py-2 font-bold disabled:opacity-50 flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              {isSaving && <Loader2 className="animate-spin" size={16} />}
              Speichern
            </Button>
          </div>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-full py-10">
          <Spinner label="Lade Serverdaten" />
        </div>
      ) : error ? (
        <ErrorCard message={error} onRetry={loadData} retryLabel="Erneut versuchen" />
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-[var(--radius-4)] bg-[color:var(--color-surface-hover)] border border-[color:var(--color-border)] flex items-center justify-center overflow-hidden">
              {previewUrl ? (
                <img src={previewUrl} alt="Server Icon" className="w-full h-full object-cover" />
              ) : (
                <Icon icon={ImageIcon} size="lg" tone="muted" />
              )}
            </div>
            <div className="flex-1 space-y-3 min-w-[240px]">
              <div className="space-y-1">
                <label className={labelClassName}>Server Name</label>
                <Input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mein Server"
                  inputSize="lg"
                  className="font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className={labelClassName}>Server Icon</label>
                <div className="flex flex-wrap gap-2 items-center">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="inline-flex items-center gap-2 font-semibold"
                    onClick={() => iconInputRef.current?.click()}
                  >
                    <Icon icon={ImageIcon} size="md" tone="default" className="text-inherit" />
                    Icon auswählen
                  </Button>
                  <Input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconChange} />
                  <Button
                    type="button"
                    onClick={handleRemoveIcon}
                    disabled={isSaving || isUploadingIcon || (!iconUrl && !iconFile)}
                    variant="ghost"
                    size="sm"
                    className="inline-flex items-center gap-2 font-semibold"
                  >
                    <Icon icon={Trash2} size="md" tone="default" className="text-inherit" />
                    Icon entfernen
                  </Button>
                  {(iconFile || removeIcon) && (
                    <span className="text-xs text-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 border border-[color:var(--color-accent)]/30 rounded-full px-2 py-1">
                      {iconFile ? `Ausgewählt: ${iconFile.name}` : 'Icon wird entfernt'}
                    </span>
                  )}
                </div>
                <p className={helperClassName}>
                  Unterstützt PNG, JPG oder WebP bis 2 MB. Die Datei wird direkt auf den Server hochgeladen und sicher gespeichert.
                </p>
                {iconError && (
                  <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-[var(--radius-3)] p-2">{iconError}</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className={`flex items-center gap-2 ${labelClassName}`}>
              <Icon icon={Shield} size="sm" tone="muted" className="text-inherit" />
              Fallback-Kanal
            </label>
            {channelOptions.length === 0 ? (
              <div className="text-sm text-[color:var(--color-text-muted)] bg-[color:var(--color-surface-hover)] border border-[color:var(--color-border)] rounded-[var(--radius-3)] p-3">
                Keine Text- oder Web-Kanäle verfügbar.
              </div>
            ) : (
              <Select
                value={fallbackChannelId ?? ''}
                onChange={(e) => setFallbackChannelId(e.target.value ? Number(e.target.value) : null)}
                selectSize="lg"
                className="w-full bg-[color:var(--color-surface)]/60"
              >
                <option value="">Kein Fallback</option>
                {channelOptions.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </Select>
            )}
            <p className={helperClassName}>
              Der Fallback-Kanal wird geöffnet, wenn kein spezifischer Kanal ausgewählt ist.
            </p>
          </div>

          <div className="rounded-[var(--radius-4)] border border-[color:var(--color-border)] bg-white/[0.02] p-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-text">Drag & Drop zum Sortieren</div>
              <p className={helperClassName}>
                Wenn deaktiviert, können nur Administratoren die Reihenfolge von Kategorien und Kanälen anpassen.
              </p>
            </div>
            <Toggle
              size="lg"
              checked={dragAndDropEnabled}
              onChange={(e) => setDragAndDropEnabled(e.target.checked)}
              aria-label="Drag & Drop zum Sortieren aktivieren"
            />
          </div>

          {actionError && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-[var(--radius-3)] p-3">{actionError}</div>
          )}

          <div className="rounded-[var(--radius-4)] border border-[color:var(--color-border)] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center gap-2 text-red-300">
              <Icon icon={Trash2} size="md" tone="default" className="text-inherit" />
              <div className="text-sm font-semibold">Server dauerhaft löschen</div>
            </div>
            <p className="text-xs text-[color:var(--color-text-muted)]">
              Diese Aktion entfernt den Server unwiderruflich. Alle Kanäle und Daten gehen verloren.
            </p>
            {deleteError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-[var(--radius-3)] p-2">
                <Icon icon={AlertTriangle} size="sm" tone="default" className="text-inherit" />
                <span>{deleteError}</span>
              </div>
            )}
            <Button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              variant="danger"
              size="md"
              className="inline-flex items-center gap-2 font-semibold shadow-lg disabled:opacity-60"
            >
              {isDeleting && <Icon icon={Loader2} size="md" tone="default" className="text-inherit animate-spin" />}
              Server löschen
            </Button>
          </div>
        </form>
      )}
    </ModalLayout>
  );
};
