import { useMemo, useState } from "react";
import { computeFingerprint, formatFingerprint, loadIdentity, saveIdentity, type IdentityFile } from "./identity";
import { performHandshake } from "./identityApi";
import { getServerPassword, getServerUrl, setServerPassword, setServerUrl } from "../utils/apiConfig";
import { IdentityModal } from "../components/modals/IdentityModal";

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
  const [showIdentityModal, setShowIdentityModal] = useState(!identity);

  const fp = useMemo(() => (identity ? computeFingerprint(identity) : null), [identity]);

  const handleIdentityChange = (next: IdentityFile | null) => {
    setIdentity(next);
    setDisplayName(next?.displayName ?? "");
    setErr(null);
    if (next) setShowIdentityModal(false);
  };

  async function handleLogin() {
    if (!identity) {
      setErr("Bitte erst eine Identity erstellen oder importieren.");
      setShowIdentityModal(true);
      return;
    }
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

        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1 text-sm">
            <div className="text-gray-400">Aktuelle Identity</div>
            {identity ? (
              <div className="mt-1 font-mono break-all text-gray-200">
                {formatFingerprint(fp!)}
              </div>
            ) : (
              <div className="mt-1 text-yellow-300">Keine Identity vorhanden.</div>
            )}
            <p className="text-gray-500 mt-2">
              Du kannst deine Identity jederzeit verwalten oder importieren, ohne diese Seite zu verlassen.
            </p>
          </div>

          <button
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 transition text-sm"
            onClick={() => setShowIdentityModal(true)}
          >
            Identity verwalten
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50"
            onClick={handleLogin}
            disabled={busy || !identity}
          >
            {busy ? "Verbinde..." : "Verbinden"}
          </button>
        </div>

        {err && <div className="mt-4 text-red-400 text-sm">{err}</div>}

        {showIdentityModal && (
          <IdentityModal onClose={() => setShowIdentityModal(false)} onIdentityChanged={handleIdentityChange} />
        )}
      </div>
    </div>
  );
}
