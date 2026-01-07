import { useState, type ChangeEvent } from 'react';
import { Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { ModalLayout } from './ModalLayout';

interface CreateServerModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export const CreateServerModal = ({ onClose, onCreated }: CreateServerModalProps) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);

  const handleIconChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setIconError(null);

    if (!file) {
      setIconFile(null);
      setIconPreview(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setIconError('Bitte eine Bilddatei auswählen.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setIconError('Das Icon darf maximal 2 MB groß sein.');
      return;
    }

    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const server = await apiFetch<{ id: number } & Record<string, any>>('/api/servers', {
        method: 'POST',
        body: JSON.stringify({ name })
      });

      if (iconFile) {
        const formData = new FormData();
        formData.append('icon', iconFile);
        await apiFetch(`/api/servers/${server.id}/icon`, {
          method: 'POST',
          body: formData,
        });
      }
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Fehler beim Erstellen des Servers");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalLayout
      title="Neuer Server"
      description="Erschaffe einen neuen Ort für deine Community."
      onClose={onClose}
      footer={
        <p className="text-[11px] text-[color:var(--color-text-muted)]">
          Durch das Erstellen stimmst du den <span className="text-[color:var(--color-accent)] cursor-pointer hover:underline">Community Guidelines</span> zu.
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-center gap-2">
          <label className="w-24 h-24 rounded-full bg-[color:var(--color-surface-hover)] border-2 border-dashed border-[color:var(--color-border-strong)] flex flex-col items-center justify-center text-[color:var(--color-text-muted)] hover:border-[var(--color-accent-hover)] hover:text-[color:var(--color-accent)] cursor-pointer transition-all group overflow-hidden">
            <input type="file" accept="image/*" className="hidden" onChange={handleIconChange} />
            {iconPreview ? (
              <img src={iconPreview} alt="Server Icon" className="w-full h-full object-cover" />
            ) : (
              <>
                <Upload size={24} className="group-hover:scale-110 transition-transform mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Icon</span>
              </>
            )}
          </label>
          <div className="flex items-center gap-2 text-xs text-[color:var(--color-text-muted)]">
            <span>{iconFile ? iconFile.name : 'PNG, JPG oder WebP bis 2 MB'}</span>
            {iconFile && (
              <button
                type="button"
                onClick={() => {
                  setIconFile(null);
                  setIconPreview(null);
                  setIconError(null);
                }}
                className="inline-flex items-center gap-1 text-red-300 hover:text-red-200"
              >
                <Trash2 size={14} />
                Entfernen
              </button>
            )}
          </div>
          {iconError && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-[var(--radius-2)] px-3 py-2 flex items-center gap-2">
              <ImageIcon size={14} />
              <span>{iconError}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-[color:var(--color-text-muted)] uppercase ml-1">Server Name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mein epischer Server"
            className="w-full bg-[color:var(--color-surface)]/60 text-white p-3 rounded-[var(--radius-3)] border border-[color:var(--color-border)] focus:border-[var(--color-focus)] focus:ring-1 focus:ring-[var(--color-focus)] outline-none transition-all placeholder:text-[color:var(--color-text-muted)] font-medium"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white py-3 rounded-[var(--radius-3)] font-bold shadow-lg shadow-[0_12px_24px_color-mix(in_srgb,var(--color-accent)_25%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : 'Server erstellen'}
        </button>
      </form>
    </ModalLayout>
  );
};
