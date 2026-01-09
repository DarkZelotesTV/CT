import { useMemo, useRef, useState } from 'react';
import { Upload, ShieldAlert, Download } from 'lucide-react';
import { ModalLayout } from './ModalLayout';
import { clearIdentity, computeFingerprint, createIdentity, formatFingerprint, loadIdentity, saveIdentity, type IdentityFile } from '../../auth/identity';
import { buildBackupPayload, getBackupFilename, parseIdentityBackup } from '../../auth/identityBackup';
import { storage } from '../../shared/config/storage';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface IdentityModalProps {
  onClose: () => void;
  onIdentityChanged?: (identity: IdentityFile | null) => void;
}

export const IdentityModal = ({ onClose, onIdentityChanged }: IdentityModalProps) => {
  const [identity, setIdentity] = useState<IdentityFile | null>(() => loadIdentity());
  const [displayName, setDisplayName] = useState(identity?.displayName ?? '');
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  const fingerprint = useMemo(() => (identity ? computeFingerprint(identity) : null), [identity]);

  const persistIdentity = (nextIdentity: IdentityFile | null) => {
    if (nextIdentity) saveIdentity(nextIdentity);
    setIdentity(nextIdentity);
    onIdentityChanged?.(nextIdentity);
  };

  const resolvedDisplayName = displayName.trim();

  async function handleCreate() {
    setError(null);
    try {
      const id = await createIdentity(resolvedDisplayName);
      persistIdentity(id);
    } catch (e: any) {
      setError(e?.message ?? 'Identity konnte nicht erstellt werden');
    }
  }

  function handleExport() {
    if (!identity) return;
    const pass = backupPassphrase.trim();
    const doExport = async () => {
      const payload = await buildBackupPayload(identity, pass);

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getBackupFilename(!!pass);
      a.click();
      URL.revokeObjectURL(url);
    };
    void doExport();
  }

  async function handleImport(file: File) {
    setError(null);
    try {
      const text = await file.text();
      const parsed = await parseIdentityBackup(text, () => window.prompt('Passphrase für dieses Backup?') ?? '');
      const next: IdentityFile = { ...parsed, displayName: parsed.displayName ?? (resolvedDisplayName || null) };
      persistIdentity(next);
      setDisplayName(next.displayName ?? '');
    } catch (e: any) {
      setError(e?.message ?? 'Import fehlgeschlagen');
    }
  }

  function handleReset() {
    clearIdentity();
    storage.remove('cloverToken');
    storage.remove('cloverUser');
    storage.remove('ctJwt');
    storage.remove('cloverServerPassword');
    setDisplayName('');
    persistIdentity(null);
  }

  function handleSaveDisplayName() {
    if (!identity) return;
    const updated: IdentityFile = { ...identity, displayName: resolvedDisplayName || null };
    persistIdentity(updated);
  }

  return (
    <ModalLayout
      title="Clover Identity verwalten"
      description="Erstelle, importiere oder sichere deine lokale Identity. Sie bleibt nur auf deinem Gerät."
      onClose={onClose}
      onOverlayClick={onClose}
      bodyClassName="p-6 space-y-4"
    >
      <div>
        <label className="text-xs uppercase font-bold text-[color:var(--color-text-muted)] block mb-1">Anzeigename (optional)</label>
        <Input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="z.B. jusbe"
          className="bg-[color:var(--color-surface)]/70 text-text p-3"
        />
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-sm text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-hover)]"
          onClick={handleSaveDisplayName}
          disabled={!identity}
        >
          Anzeigename speichern
        </Button>
      </div>

      {!identity ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            variant="primary"
            className="px-4 py-3 font-medium"
            onClick={handleCreate}
          >
            Identity erstellen
          </Button>

          <div>
            <Button
              type="button"
              className="w-full px-4 py-3 bg-[color:var(--color-surface-hover)]/80 hover:bg-[color:var(--color-surface-hover)]/90 transition text-text font-medium"
              onClick={() => importInputRef.current?.click()}
            >
              <Upload size={18} />
              <span>Identity importieren</span>
            </Button>
            <Input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
              }}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="text-sm bg-white/[0.02] border border-[color:var(--color-border)]/70 rounded-[var(--radius-3)] p-3">
              <div className="text-[color:var(--color-text-muted)] mb-1">Erstellt</div>
              <div className="text-[color:var(--color-text)]">{identity.createdAt ? new Date(identity.createdAt).toLocaleString() : '–'}</div>
            </div>

            <div className="text-sm bg-white/[0.02] border border-[color:var(--color-border)]/70 rounded-[var(--radius-3)] p-3">
              <div className="text-[color:var(--color-text-muted)] mb-1">Public Key</div>
              <div className="font-mono break-all text-[color:var(--color-text)]">{identity.publicKeyB64}</div>
            </div>
          </div>

          <div className="text-sm bg-white/[0.02] border border-[color:var(--color-border)]/70 rounded-[var(--radius-3)] p-3">
            <div className="text-[color:var(--color-text-muted)] mb-1">Fingerprint</div>
            <div className="font-mono break-all text-[color:var(--color-text)]">{fingerprint ? formatFingerprint(fingerprint) : '–'}</div>
          </div>

          <div>
            <label className="text-xs uppercase font-bold text-[color:var(--color-text-muted)] block mb-1">Backup-Passphrase (optional)</label>
            <Input
              type="password"
              value={backupPassphrase}
              onChange={(e) => setBackupPassphrase(e.target.value)}
              placeholder="Leer lassen für Klartext-Export"
              className="bg-[color:var(--color-surface)]/70 text-text p-3"
            />
            <p className="text-[11px] text-[color:var(--color-text-muted)] mt-1">Wenn gesetzt, wird dein Backup AES-GCM verschlüsselt (PBKDF2).</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              className="px-4 py-3 bg-[color:var(--color-surface-hover)]/80 hover:bg-[color:var(--color-surface-hover)]/90 transition text-text font-medium flex items-center justify-center gap-2"
              onClick={handleExport}
            >
              <Download size={18} />
              Export / Backup
            </Button>

            <div>
              <Button
                type="button"
                className="w-full px-4 py-3 bg-[color:var(--color-surface-hover)]/80 hover:bg-[color:var(--color-surface-hover)]/90 transition text-text font-medium"
                onClick={() => replaceInputRef.current?.click()}
              >
                <Upload size={18} />
                <span>Import (ersetzen)</span>
              </Button>
              <Input
                ref={replaceInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f);
                }}
              />
            </div>

            <Button
              className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 transition text-red-100 font-medium flex items-center justify-center gap-2 sm:col-span-2"
              onClick={handleReset}
            >
              <ShieldAlert size={18} />
              Identity zurücksetzen
            </Button>
          </div>
        </>
      )}

      {error && <div className="text-red-400 text-sm">{error}</div>}
    </ModalLayout>
  );
};
