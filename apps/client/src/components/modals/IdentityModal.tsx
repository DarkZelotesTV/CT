import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, ShieldAlert, Download } from 'lucide-react';
import { getModalRoot } from './modalRoot';
import { clearIdentity, computeFingerprint, createIdentity, formatFingerprint, loadIdentity, saveIdentity, type IdentityFile } from '../../auth/identity';
import { buildBackupPayload, getBackupFilename, parseIdentityBackup } from '../../auth/identityBackup';
import { storage } from '../../shared/config/storage';

interface IdentityModalProps {
  onClose: () => void;
  onIdentityChanged?: (identity: IdentityFile | null) => void;
}

export const IdentityModal = ({ onClose, onIdentityChanged }: IdentityModalProps) => {
  const [identity, setIdentity] = useState<IdentityFile | null>(() => loadIdentity());
  const [displayName, setDisplayName] = useState(identity?.displayName ?? '');
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  const target = getModalRoot();
  if (!target) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 2147483647, transform: 'translateZ(0)', willChange: 'transform' }}
    >
      <div className="bg-[#0f1014] w-full max-w-xl rounded-2xl shadow-2xl border border-white/10 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10"
        >
          <X size={20} />
        </button>

        <div className="p-6 border-b border-white/5">
          <h2 className="text-2xl font-bold text-white">Clover Identity verwalten</h2>
          <p className="text-gray-400 text-sm mt-1">
            Erstelle, importiere oder sichere deine lokale Identity. Sie bleibt nur auf deinem Gerät.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs uppercase font-bold text-gray-400 block mb-1">Anzeigename (optional)</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="z.B. jusbe"
              className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
            <button
              className="mt-2 text-sm text-indigo-400 hover:text-indigo-300"
              onClick={handleSaveDisplayName}
              disabled={!identity}
            >
              Anzeigename speichern
            </button>
          </div>

          {!identity ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition text-white font-medium"
                onClick={handleCreate}
              >
                Identity erstellen
              </button>

              <label className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition cursor-pointer text-center text-white font-medium">
                <div className="flex items-center justify-center gap-2">
                  <Upload size={18} />
                  <span>Identity importieren</span>
                </div>
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImport(f);
                  }}
                />
              </label>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="text-sm bg-white/[0.02] border border-white/5 rounded-xl p-3">
                  <div className="text-gray-400 mb-1">Erstellt</div>
                  <div className="text-gray-200">
                    {identity.createdAt ? new Date(identity.createdAt).toLocaleString() : '–'}
                  </div>
                </div>

                <div className="text-sm bg-white/[0.02] border border-white/5 rounded-xl p-3">
                  <div className="text-gray-400 mb-1">Public Key</div>
                  <div className="font-mono break-all text-gray-200">{identity.publicKeyB64}</div>
                </div>
              </div>

              <div className="text-sm bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <div className="text-gray-400 mb-1">Fingerprint</div>
                <div className="font-mono break-all text-gray-200">{fingerprint ? formatFingerprint(fingerprint) : '–'}</div>
              </div>

              <div>
                <label className="text-xs uppercase font-bold text-gray-400 block mb-1">Backup-Passphrase (optional)</label>
                <input
                  type="password"
                  value={backupPassphrase}
                  onChange={(e) => setBackupPassphrase(e.target.value)}
                  placeholder="Leer lassen für Klartext-Export"
                  className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Wenn gesetzt, wird dein Backup AES-GCM verschlüsselt (PBKDF2).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition text-white font-medium flex items-center justify-center gap-2"
                  onClick={handleExport}
                >
                  <Download size={18} />
                  Export / Backup
                </button>

                <label className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition cursor-pointer text-center text-white font-medium">
                  <div className="flex items-center justify-center gap-2">
                    <Upload size={18} />
                    <span>Import (ersetzen)</span>
                  </div>
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImport(f);
                    }}
                  />
                </label>

                <button
                  className="px-4 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition text-red-100 font-medium flex items-center justify-center gap-2 sm:col-span-2"
                  onClick={handleReset}
                >
                  <ShieldAlert size={18} />
                  Identity zurücksetzen
                </button>
              </div>
            </>
          )}

          {error && <div className="text-red-400 text-sm">{error}</div>}
        </div>
      </div>
    </div>,
    target
  );
};
