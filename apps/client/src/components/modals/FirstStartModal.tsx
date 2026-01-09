import { useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Download, Upload } from "lucide-react";
import { ModalLayout } from "./ModalLayout";
import { Icon } from "../ui";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
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
            <div className="text-text font-semibold">Identity erstellen oder importieren</div>
            <p className="text-[color:var(--color-text-muted)] text-xs">Ohne Identity kannst du dich nicht mit einem Server verbinden.</p>
          </div>
        </div>

        <label className="text-xs uppercase font-semibold text-[color:var(--color-text-muted)] block">Anzeigename (optional)</label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="z.B. jusbe"
          className="bg-[color:var(--color-surface)]/70 p-3 text-text"
        />

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleCreate}
            variant="primary"
            className="px-4 py-3 transition flex items-center gap-2"
          >
            <Icon icon={ArrowRight} size="lg" tone="default" className="text-inherit" /> Identity erstellen
          </Button>
          <Button
            onClick={triggerFileSelect}
            className="px-4 py-3 bg-[color:var(--color-surface-hover)]/80 hover:bg-[color:var(--color-surface-hover)]/90 transition flex items-center gap-2"
          >
            <Icon icon={Upload} size="lg" tone="default" className="text-inherit" /> Identity importieren
          </Button>
          <Input
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

        <div className="text-sm text-[color:var(--color-text-muted)] bg-[color:var(--color-surface-hover)] border border-[color:var(--color-border)] rounded-[var(--radius-4)] p-4">
          <div className="text-text font-semibold">Aktuelle Identity</div>
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
            <div className="text-text font-semibold">Backup speichern</div>
            <p className="text-[color:var(--color-text-muted)] text-xs">Sichere deine Identity als Datei. Optional mit Passphrase verschlüsselt.</p>
          </div>
        </div>

        <label className="text-xs uppercase font-semibold text-[color:var(--color-text-muted)] block">Passphrase fürs Backup (optional)</label>
        <Input
          value={backupPassphrase}
          onChange={(e) => setBackupPassphrase(e.target.value)}
          placeholder="Leer lassen für unverschlüsselt"
          className="bg-[color:var(--color-surface)]/70 p-3 text-text"
        />

        <Button
          onClick={handleExport}
          disabled={!identity}
          className="px-4 py-3 bg-[color:var(--color-surface-hover)]/80 hover:bg-[color:var(--color-surface-hover)]/90 disabled:opacity-50 transition flex items-center gap-2"
        >
          <Icon icon={Download} size="lg" tone="default" className="text-inherit" /> Backup herunterladen
        </Button>

        <div className="text-xs text-[color:var(--color-text-muted)] bg-[color:var(--color-surface-hover)] border border-[color:var(--color-accent)]/30 rounded-[var(--radius-4)] p-4 flex items-start gap-3">
          <Icon icon={Check} size="md" tone="accent" className="mt-0.5" />
          <div>
            Bewahre dein Backup sicher auf. Ohne Backup kannst du deine Identität auf neuen Geräten nicht wiederherstellen.
          </div>
        </div>

        <Button
          onClick={finish}
          className="w-full py-3 bg-green-600 hover:bg-green-500 transition text-[color:var(--color-on-accent)] font-semibold text-center"
        >
          Weiter zum Login
        </Button>

        {error && <div className="text-red-400 text-sm">{error}</div>}
      </div>
    </ModalLayout>
  );
}
