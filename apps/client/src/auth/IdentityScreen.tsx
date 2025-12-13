import { useMemo, useState } from "react";
import {
  clearIdentity,
  computeFingerprint,
  createIdentity,
  formatFingerprint,
  loadIdentity,
  saveIdentity,
  type IdentityFile,
} from "./identity";
import { performHandshake } from "./identityApi";
import { getServerPassword, getServerUrl, setServerPassword, setServerUrl } from "../utils/apiConfig";

type Props = {
  onAuthed: (user: { id: number; username?: string | null; displayName: string | null; fingerprint: string }) => void;
};

export function IdentityScreen({ onAuthed }: Props) {
  const [identity, setIdentity] = useState<IdentityFile | null>(() => loadIdentity());
  const [displayName, setDisplayName] = useState(identity?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [serverHost, setServerHost] = useState<string>(getServerUrl());
  const [serverPassword, setPassword] = useState<string>(getServerPassword());

  const fp = useMemo(() => (identity ? computeFingerprint(identity) : null), [identity]);

  async function handleCreate() {
    setErr(null);
    const id = await createIdentity(displayName || undefined);
    saveIdentity(id);
    setIdentity(id);
  }

  function handleExport() {
    if (!identity) return;
    const blob = new Blob([JSON.stringify(identity, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clover-identity.cloverid.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    setErr(null);
    const text = await file.text();
    const parsed = JSON.parse(text) as IdentityFile;
    if (!parsed?.publicKeyB64 || !parsed?.privateKeyB64) throw new Error("Ungültige Identity-Datei");
    saveIdentity(parsed);
    setDisplayName(parsed.displayName ?? "");
    setIdentity(parsed);
  }

  async function handleLogin() {
    if (!identity) return;
    setBusy(true);
    setErr(null);
    try {
      const updated: IdentityFile = { ...identity, displayName: displayName || undefined };
      saveIdentity(updated);
      setIdentity(updated);
      setServerUrl(serverHost);
      setServerPassword(serverPassword);

      const { user } = await performHandshake(updated, serverPassword);

      onAuthed({
        ...user,
        username: user.displayName ?? user.username ?? `user_${user.id}`,
      });
    } catch (e: any) {
      setErr(e?.message ?? "Login fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    clearIdentity();
    localStorage.removeItem("clover_token");
    localStorage.removeItem("clover_user");
    localStorage.removeItem("ct.jwt");
    localStorage.removeItem("clover_server_password");
    setIdentity(null);
    setDisplayName("");
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#050507] text-gray-200 p-6">
      <div className="w-full max-w-xl bg-white/[0.03] border border-white/10 rounded-3xl p-6">
        <h1 className="text-2xl font-bold mb-2">Clover Identity</h1>
        <p className="text-sm text-gray-400 mb-6">
          Keine E-Mail, kein Passwort. Deine Identität ist ein lokaler Schlüssel (wie TS3).
        </p>

        <label className="block text-sm text-gray-300 mb-2">Server Adresse</label>
        <input
          className="w-full rounded-xl bg-black/40 border border-white/10 p-3 mb-4 outline-none"
          value={serverHost}
          onChange={(e) => setServerHost(e.target.value)}
          placeholder="http://localhost:3001"
        />

        <label className="block text-sm text-gray-300 mb-2">Server Passwort (optional)
        </label>
        <input
          className="w-full rounded-xl bg-black/40 border border-white/10 p-3 mb-4 outline-none"
          value={serverPassword}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leer lassen wenn keins"
        />

        <label className="block text-sm text-gray-300 mb-2">Anzeigename (optional)</label>
        <input
          className="w-full rounded-xl bg-black/40 border border-white/10 p-3 mb-4 outline-none"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="z.B. jusbe"
        />

        {!identity ? (
          <div className="flex gap-3">
            <button
              className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition"
              onClick={handleCreate}
            >
              Identity erstellen
            </button>

            <label className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition cursor-pointer">
              Identity importieren
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f).catch((x) => setErr(String(x?.message ?? x)));
                }}
              />
            </label>
          </div>
        ) : (
          <>
            <div className="mt-2 mb-4 text-sm">
              <div className="text-gray-400">Fingerprint</div>
              <div className="font-mono break-all text-gray-200">{formatFingerprint(fp!)}</div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50"
                onClick={handleLogin}
                disabled={busy}
              >
                {busy ? "Verbinde..." : "Verbinden"}
              </button>

              <button
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition"
                onClick={handleExport}
              >
                Export / Backup
              </button>

              <label className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 transition cursor-pointer">
                Import (ersetzen)
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImport(f).catch((x) => setErr(String(x?.message ?? x)));
                  }}
                />
              </label>

              <button
                className="px-4 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition"
                onClick={handleReset}
              >
                Zurücksetzen
              </button>
            </div>
          </>
        )}

        {err && <div className="mt-4 text-red-400 text-sm">{err}</div>}
      </div>
    </div>
  );
}
