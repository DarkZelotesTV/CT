import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, ShieldAlert, Download } from 'lucide-react';
import {
  clearIdentity,
  computeFingerprint,
  createIdentity,
  formatFingerprint,
  loadIdentity,
  saveIdentity,
  type IdentityFile
} from '../../auth/identity';

interface IdentityModalProps {
  onClose: () => void;
  onIdentityChanged?: (identity: IdentityFile | null) => void;
}

type EncryptedBackupV1 = {
  kind: 'clover-identity-backup';
  version: 1;
  encrypted: true;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64FromBytes(u8: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

function bytesFromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array, iterations: number) {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptBackup(plaintext: string, passphrase: string): Promise<EncryptedBackupV1> {
  const iterations = 150_000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt, iterations);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return {
    kind: 'clover-identity-backup',
    version: 1,
    encrypted: true,
    kdf: 'PBKDF2-SHA256',
    iterations,
    saltB64: b64FromBytes(salt),
    ivB64: b64FromBytes(iv),
    ciphertextB64: b64FromBytes(new Uint8Array(ct)),
  };
}

async function decryptBackup(backup: EncryptedBackupV1, passphrase: string): Promise<string> {
  const salt = bytesFromB64(backup.saltB64);
  const iv = bytesFromB64(backup.ivB64);
  const ct = bytesFromB64(backup.ciphertextB64);
  const iterations = Number(backup.iterations) || 150_000;
  const key = await deriveAesKey(passphrase, salt, iterations);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return dec.decode(pt);
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

  async function handleCreate() {
    setError(null);
    try {
      const id = await createIdentity(displayName || undefined);
      persistIdentity(id);
    } catch (e: any) {
      setError(e?.message ?? 'Identity konnte nicht erstellt werden');
    }
  }

  function handleExport() {
    if (!identity) return;
    const pass = backupPassphrase.trim();
    const doExport = async () => {
      const payload = pass
        ? await encryptBackup(JSON.stringify(identity), pass)
        : identity;

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pass ? 'clover-identity.backup.encrypted.json' : 'clover-identity.cloverid.json';
      a.click();
      URL.revokeObjectURL(url);
    };
    void doExport();
  }

  async function handleImport(file: File) {
    setError(null);
    try {
      const text = await file.text();
      const parsedAny: any = JSON.parse(text);

      // Encrypted backup format
      let parsed: any = parsedAny;
      if (parsedAny?.kind === 'clover-identity-backup' && parsedAny?.encrypted) {
        const pass = window.prompt('Passphrase für dieses Backup?') || '';
        if (!pass.trim()) throw new Error('Passphrase fehlt');
        const decrypted = await decryptBackup(parsedAny, pass.trim());
        parsed = JSON.parse(decrypted);
      }

      if (!parsed?.publicKeyB64 || !parsed?.privateKeyB64) throw new Error('Ungültige Identity-Datei');
      const trimmed = (displayName ?? "").trim();
      const next = { ...parsed, displayName: parsed.displayName ?? (trimmed ? trimmed : undefined) }; 
      persistIdentity(next);
      setDisplayName(next.displayName ?? '');
    } catch (e: any) {
      setError(e?.message ?? 'Import fehlgeschlagen');
    }
  }

  function handleReset() {
    clearIdentity();
    localStorage.removeItem('clover_token');
    localStorage.removeItem('clover_user');
    localStorage.removeItem('ct.jwt');
    localStorage.removeItem('clover_server_password');
    setDisplayName('');
    persistIdentity(null);
  }

  function handleSaveDisplayName() {
    if (!identity) return;
    const updated: IdentityFile = { ...identity, displayName: displayName || undefined };
    persistIdentity(updated);
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
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
    document.body
  );
};
