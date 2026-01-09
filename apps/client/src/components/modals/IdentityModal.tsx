import { useMemo, useRef, useState } from 'react';
import { Upload, ShieldAlert, Download } from 'lucide-react';
import { ModalLayout } from './ModalLayout';
import { clearIdentity, computeFingerprint, createIdentity, formatFingerprint, loadIdentity, saveIdentity, type IdentityFile } from '../../auth/identity';
import { buildBackupPayload, getBackupFilename, parseIdentityBackup } from '../../auth/identityBackup';
import { storage } from '../../shared/config/storage';
import { Icon } from '../ui';
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
  const labelClassName = 'text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]';
  const helperClassName = 'text-xs text-[color:var(--color-text-muted)]';

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
        <label className={`block mb-1 ${labelClassName}`}>Anzeigename (optional)</label>
        <Input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="z.B. jusbe"
          inputSize="lg"
        />
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-xs text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-hover)]"
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
            size="lg"
            className="font-semibold"
            onClick={handleCreate}
          >
            Identity erstellen
          </Button>

          <div>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full font-semibold"
              onClick={() => importInputRef.current?.click()}
            >
              <Icon icon={Upload} size="lg" tone="default" className="text-inherit" />
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
            <label className={`block mb-1 ${labelClassName}`}>Backup-Passphrase (optional)</label>
            <Input
              type="password"
              value={backupPassphrase}
              onChange={(e) => setBackupPassphrase(e.target.value)}
              placeholder="Leer lassen für Klartext-Export"
              inputSize="lg"
            />
            <p className={`${helperClassName} mt-1`}>Wenn gesetzt, wird dein Backup AES-GCM verschlüsselt (PBKDF2).</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="secondary"
              size="lg"
              className="font-semibold flex items-center justify-center gap-2"
              onClick={handleExport}
            >
              <Icon icon={Download} size="lg" tone="default" className="text-inherit" />
              Export / Backup
            </Button>

            <div>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full font-semibold"
                onClick={() => replaceInputRef.current?.click()}
              >
                <Icon icon={Upload} size="lg" tone="default" className="text-inherit" />
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
              variant="danger"
              size="lg"
              className="flex items-center justify-center gap-2 sm:col-span-2"
              onClick={handleReset}
            >
              <Icon icon={ShieldAlert} size="lg" tone="default" className="text-inherit" />
              Identity zurücksetzen
            </Button>
          </div>
        </>
      )}

      {error && <div className="text-red-400 text-sm">{error}</div>}
    </ModalLayout>
  );
};
