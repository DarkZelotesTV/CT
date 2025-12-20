import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertTriangle, Image as ImageIcon, Loader2, Shield, Trash2 } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { ModalLayout } from './ModalLayout';
import { ErrorCard, Spinner } from '../ui';
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
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dragAndDropEnabled, setDragAndDropEnabled] = useState(true);

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
            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-white/5"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-bold disabled:opacity-50 flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              {isSaving && <Loader2 className="animate-spin" size={16} />}
              Speichern
            </button>
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
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
              {previewUrl ? (
                <img src={previewUrl} alt="Server Icon" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="text-gray-500" />
              )}
            </div>
            <div className="flex-1 space-y-3 min-w-[240px]">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Server Name</label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mein Server"
                  className="w-full bg-black/30 text-white p-3 rounded-xl border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-600 font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Server Icon</label>
                <div className="flex flex-wrap gap-2 items-center">
                  <label className="cursor-pointer inline-flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-lg text-sm font-semibold hover:border-indigo-500 hover:text-indigo-300 transition-colors">
                    <input type="file" accept="image/*" className="hidden" onChange={handleIconChange} />
                    <ImageIcon size={16} />
                    Icon auswählen
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveIcon}
                    disabled={isSaving || isUploadingIcon || (!iconUrl && !iconFile)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border border-white/10 text-white/80 hover:text-white hover:border-red-400 hover:text-red-200 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    Icon entfernen
                  </button>
                  {(iconFile || removeIcon) && (
                    <span className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-2 py-1">
                      {iconFile ? `Ausgewählt: ${iconFile.name}` : 'Icon wird entfernt'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500">
                  Unterstützt PNG, JPG oder WebP bis 2 MB. Die Datei wird direkt auf den Server hochgeladen und sicher gespeichert.
                </p>
                {iconError && (
                  <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-2">{iconError}</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase ml-1 flex items-center gap-2">
              <Shield size={14} />
              Fallback-Kanal
            </label>
            {channelOptions.length === 0 ? (
              <div className="text-sm text-gray-400 bg-white/5 border border-white/10 rounded-xl p-3">
                Keine Text- oder Web-Kanäle verfügbar.
              </div>
            ) : (
              <select
                value={fallbackChannelId ?? ''}
                onChange={(e) => setFallbackChannelId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-black/30 text-white p-3 rounded-xl border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
              >
                <option value="">Kein Fallback</option>
                {channelOptions.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-gray-500">
              Der Fallback-Kanal wird geöffnet, wenn kein spezifischer Kanal ausgewählt ist.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-white">Drag & Drop zum Sortieren</div>
              <p className="text-xs text-gray-400">
                Wenn deaktiviert, können nur Administratoren die Reihenfolge von Kategorien und Kanälen anpassen.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                className="sr-only"
                checked={dragAndDropEnabled}
                onChange={(e) => setDragAndDropEnabled(e.target.checked)}
              />
              <span
                className={`h-6 w-11 rounded-full transition-colors ${
                  dragAndDropEnabled ? 'bg-indigo-500' : 'bg-white/10'
                }`}
              >
                <span
                  className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    dragAndDropEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </label>
          </div>

          {actionError && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-3">{actionError}</div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center gap-2 text-red-300">
              <Trash2 size={16} />
              <div className="text-sm font-semibold">Server dauerhaft löschen</div>
            </div>
            <p className="text-xs text-gray-400">
              Diese Aktion entfernt den Server unwiderruflich. Alle Kanäle und Daten gehen verloren.
            </p>
            {deleteError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                <AlertTriangle size={14} />
                <span>{deleteError}</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 bg-red-600/90 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold shadow-lg shadow-red-900/30 disabled:opacity-60"
            >
              {isDeleting && <Loader2 className="animate-spin" size={16} />}
              Server löschen
            </button>
          </div>
        </form>
      )}
    </ModalLayout>
  );
};
