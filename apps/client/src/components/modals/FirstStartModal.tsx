import { useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Download, Upload } from "lucide-react";
import { ModalLayout } from "./ModalLayout";
import { computeFingerprint, createIdentity, formatFingerprint, loadIdentity, saveIdentity, type IdentityFile } from "../../auth/identity";
import { buildBackupPayload, getBackupFilename, parseIdentityBackup } from "../../auth/identityBackup";
import { storage } from "../../shared/config/storage";

type Props = {
  onComplete: (identity: IdentityFile | null) => void;
};

export function FirstStartModal({ onComplete }: Props) {
  const [identity, setIdentity] = useState<IdentityFile | null>(() => loadIdentity());
  const [displayName, setDisplayName] = useState(identity?.displayName ?? "");
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [step, setStep] = useState<"identity" | "backup">(identity ? "backup" : "identity");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fp = useMemo(() => (identity ? computeFingerprint(identity) : null), [identity]);

  const persistIdentity = (next: IdentityFile) => {
    const resolvedName = (displayName || next.displayName || "").trim();
    const updated: IdentityFile = resolvedName
      ? { ...next, displayName: resolvedName }
      : { ...next, displayName: null };
    saveIdentity(updated);
    setIdentity(updated);
    setError(null);
  };

  async function handleCreate() {
    setError(null);
    try {
      const created = await createIdentity(displayName);
      persistIdentity(created);
      setStep("backup");
    } catch (e: any) {
      setError(e?.message ?? "Identity konnte nicht erstellt werden");
    }
  }

  async function handleImport(file: File) {
    setError(null);
    try {
      const text = await file.text();
      const parsed = await parseIdentityBackup(text, () => window.prompt("Passphrase für dieses Backup?")?.trim() ?? "");
      persistIdentity(parsed);
      setDisplayName(parsed.displayName ?? "");
      setStep("backup");
    } catch (e: any) {
      setError(e?.message ?? "Import fehlgeschlagen");
    }
  }

  function triggerFileSelect() {
    fileInputRef.current?.click();
  }

  function handleExport() {
    if (!identity) return;
    const pass = backupPassphrase.trim();
    const doExport = async () => {
      const payload = await buildBackupPayload(identity, pass);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = getBackupFilename(!!pass);
      a.click();
      URL.revokeObjectURL(url);
    };
    void doExport();
  }

  function finish() {
    if (!identity) {
      setError("Bitte erst eine Identity erstellen oder importieren.");
      return;
    }
    storage.set("firstStartDone", true);
    onComplete(identity);
  }

  return (
    <ModalLayout
      title="Lege deine Clover Identity an"
      description="Deine Identity bleibt lokal auf deinem Gerät. Erstelle oder importiere sie und sichere direkt ein Backup."
      onClose={finish}
      onOverlayClick={finish}
      bodyClassName="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-[color:var(--color-text)]">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step === "identity" ? "bg-[var(--color-accent)]" : "bg-[color:var(--color-surface-hover)]/80"}`}>
            <span className="font-bold">1</span>
          </div>
          <div>
            <div className="text-white font-semibold">Identity erstellen oder importieren</div>
            <p className="text-[color:var(--color-text-muted)] text-xs">Ohne Identity kannst du dich nicht mit einem Server verbinden.</p>
          </div>
        </div>

        <label className="text-xs uppercase font-semibold text-[color:var(--color-text-muted)] block">Anzeigename (optional)</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="z.B. jusbe"
          className="w-full rounded-xl bg-[color:var(--color-surface)]/70 border border-[color:var(--color-border)] p-3 text-white outline-none focus:border-[var(--color-focus)]"
        />

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCreate}
            className="px-4 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white transition flex items-center gap-2"
          >
            <ArrowRight size={18} /> Identity erstellen
          </button>
          <button
            onClick={triggerFileSelect}
            className="px-4 py-3 rounded-xl bg-[color:var(--color-surface-hover)]/80 hover:bg-[color:var(--color-surface-hover)]/90 transition flex items-center gap-2"
          >
            <Upload size={18} /> Identity importieren
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.target.value = "";
            }}
          />
        </div>

        <div className="text-sm text-[color:var(--color-text-muted)] bg-[color:var(--color-surface-hover)] border border-[color:var(--color-border)] rounded-2xl p-4">
          <div className="text-white font-semibold">Aktuelle Identity</div>
          {identity ? (
            <div className="mt-2 font-mono break-all text-[color:var(--color-accent)]">{formatFingerprint(fp!)}</div>
          ) : (
            <div className="mt-2 text-yellow-300">Noch keine Identity vorhanden.</div>
          )}
          <p className="mt-2 text-[color:var(--color-text-muted)] text-xs">
            Identitäten bleiben lokal. Du kannst sie jederzeit neu exportieren oder später in den Einstellungen verwalten.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-[color:var(--color-text)]">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step === "backup" ? "bg-[var(--color-accent)]" : "bg-[color:var(--color-surface-hover)]/80"}`}>
            <span className="font-bold">2</span>
          </div>
          <div>
            <div className="text-white font-semibold">Backup speichern</div>
            <p className="text-[color:var(--color-text-muted)] text-xs">Sichere deine Identity als Datei. Optional mit Passphrase verschlüsselt.</p>
          </div>
        </div>

        <label className="text-xs uppercase font-semibold text-[color:var(--color-text-muted)] block">Passphrase fürs Backup (optional)</label>
        <input
          value={backupPassphrase}
          onChange={(e) => setBackupPassphrase(e.target.value)}
          placeholder="Leer lassen für unverschlüsselt"
          className="w-full rounded-xl bg-[color:var(--color-surface)]/70 border border-[color:var(--color-border)] p-3 text-white outline-none focus:border-[var(--color-focus)]"
        />

        <button
          onClick={handleExport}
          disabled={!identity}
          className="px-4 py-3 rounded-xl bg-[color:var(--color-surface-hover)]/80 hover:bg-[color:var(--color-surface-hover)]/90 disabled:opacity-50 transition flex items-center gap-2"
        >
          <Download size={18} /> Backup herunterladen
        </button>

        <div className="text-xs text-[color:var(--color-text-muted)] bg-[color:var(--color-surface-hover)] border border-[color:var(--color-accent)]/30 rounded-2xl p-4 flex items-start gap-3">
          <Check className="text-[color:var(--color-accent)] mt-0.5" size={16} />
          <div>
            Bewahre dein Backup sicher auf. Ohne Backup kannst du deine Identität auf neuen Geräten nicht wiederherstellen.
          </div>
        </div>

        <button
          onClick={finish}
          className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 transition text-white font-semibold text-center"
        >
          Weiter zum Login
        </button>

        {error && <div className="text-red-400 text-sm">{error}</div>}
      </div>
    </ModalLayout>
  );
}
