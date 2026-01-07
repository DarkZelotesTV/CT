import { useMemo, useState } from "react";
import { computeFingerprint, formatFingerprint, loadIdentity, saveIdentity, type IdentityFile } from "./identity";
import { performHandshake } from "./identityApi";
import { getAllowInsecureHttp, getServerPassword, getServerUrl, normalizeServerUrlString, setAllowInsecureHttp, setServerPassword, setServerUrl } from "../utils/apiConfig";
import { IdentityModal } from "../components/modals/IdentityModal";

type Props = {
  onAuthed: (user: { id: number; username?: string | null; displayName: string | null; fingerprint: string }) => void;
  onIdentityChanged?: (identity: IdentityFile | null) => void;
};

export function IdentityScreen({ onAuthed, onIdentityChanged }: Props) {
  const [identity, setIdentity] = useState<IdentityFile | null>(() => loadIdentity());
  const [displayName, setDisplayName] = useState(identity?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [serverHost, setServerHost] = useState<string>(getServerUrl());
  const [serverPassword, setPassword] = useState<string>(getServerPassword());
  const [allowInsecureHttp, setAllowHttp] = useState<boolean>(getAllowInsecureHttp());
  const [showIdentityModal, setShowIdentityModal] = useState(!identity);

  const fp = useMemo(() => (identity ? computeFingerprint(identity) : null), [identity]);

  const buildUpdatedIdentity = (): IdentityFile => {
    if (!identity) throw new Error("Identity missing");
    const trimmed = displayName.trim();
    return trimmed ? { ...identity, displayName: trimmed } : { ...identity, displayName: null };
  };

  const handleIdentityChange = (next: IdentityFile | null) => {
    setIdentity(next);
    setDisplayName(next?.displayName ?? "");
    setErr(null);
    if (next) setShowIdentityModal(false);
    onIdentityChanged?.(next);
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
      const updated = buildUpdatedIdentity();
      saveIdentity(updated);
      setIdentity(updated);
      const normalizedHost = normalizeServerUrlString(serverHost);
      setServerHost(normalizedHost);
      setServerUrl(normalizedHost);
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

  async function handleSkip() {
    if (!identity) {
      setErr("Bitte erst eine Identity erstellen oder importieren.");
      setShowIdentityModal(true);
      return;
    }

    const updated = buildUpdatedIdentity();
    saveIdentity(updated);
    setIdentity(updated);
    onIdentityChanged?.(updated);

    const username = updated.displayName ?? (fp ? `local_${fp.slice(0, 6)}` : "offline_user");
    onAuthed({
      id: -1,
      username,
      displayName: updated.displayName ?? null,
      fingerprint: computeFingerprint(updated),
    });
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[color:var(--color-background)] text-[color:var(--color-text)] p-6">
      <div className="w-full max-w-xl bg-[color:var(--color-surface)]/40 border border-[color:var(--color-border)] rounded-3xl p-6">
        <h1 className="text-2xl font-bold mb-2">Clover Identity</h1>
        <p className="text-sm text-[color:var(--color-text-muted)] mb-6">
          Keine E-Mail, kein Passwort. Deine Identität ist ein lokaler Schlüssel (wie TS3).
        </p>

        <label className="block text-sm text-[color:var(--color-text-muted)] mb-2">Anzeigename (optional)</label>
        <input
          className="w-full rounded-xl bg-[color:var(--color-surface)]/70 border border-[color:var(--color-border)] p-3 mb-4 outline-none text-[color:var(--color-text)]"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="z.B. jusbe"
        />

        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1 text-sm">
            <div className="text-[color:var(--color-text-muted)]">Aktuelle Identity</div>
            {identity ? (
              <div className="mt-1 font-mono break-all text-[color:var(--color-text)]">{formatFingerprint(fp!)}</div>
            ) : (
              <div className="mt-1 text-yellow-300">Keine Identity vorhanden.</div>
            )}
            <p className="text-[color:var(--color-text-muted)] mt-2">
              Erstelle oder importiere zuerst eine Identity. Danach kannst du dich mit einem Server verbinden.
            </p>
          </div>

          <button
            className="px-4 py-2 rounded-xl bg-[color:var(--color-surface-hover)]/80 hover:bg-[color:var(--color-surface-hover)]/90 transition text-sm"
            onClick={() => setShowIdentityModal(true)}
          >
            Identity verwalten
          </button>
        </div>

        {identity && (
          <>
            <label className="block text-sm text-[color:var(--color-text-muted)] mb-2">Server Adresse</label>
            <input
              className="w-full rounded-xl bg-[color:var(--color-surface)]/70 border border-[color:var(--color-border)] p-3 mb-4 outline-none text-[color:var(--color-text)]"
              value={serverHost}
              onChange={(e) => setServerHost(e.target.value)}
              onBlur={() => setServerHost(normalizeServerUrlString(serverHost))}
              placeholder="https://localhost:3001"
            />
            <div className="flex items-center gap-2 mb-4 text-xs text-[color:var(--color-text-muted)]">
              <input
                id="allow-http-identity"
                type="checkbox"
                className="rounded border-[color:var(--color-border)] bg-[color:var(--color-surface)]/70"
                checked={allowInsecureHttp}
                onChange={(e) => {
                  const allow = e.target.checked;
                  setAllowHttp(allow);
                  setAllowInsecureHttp(allow);
                  setServerHost(normalizeServerUrlString(serverHost, { allowInsecure: allow }));
                }}
              />
              <label htmlFor="allow-http-identity" className="leading-tight">
                Unsichere <code className="text-[color:var(--color-text)]">http://</code> Verbindungen erlauben (nur lokale Entwicklung)
              </label>
            </div>

            <label className="block text-sm text-[color:var(--color-text-muted)] mb-2">Server Passwort (optional)
            </label>
            <input
              className="w-full rounded-xl bg-[color:var(--color-surface)]/70 border border-[color:var(--color-border)] p-3 mb-4 outline-none text-[color:var(--color-text)]"
              value={serverPassword}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leer lassen wenn keins"
            />
          </>
        )}

        <div className="text-xs text-[color:var(--color-text-muted)] mb-4">
          Du kannst die Server-Verbindung überspringen und später in den Einstellungen setzen.
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50"
            onClick={handleLogin}
            disabled={busy || !identity}
          >
            {busy ? "Verbinde..." : "Verbinden"}
          </button>
          <button
            className="px-4 py-3 rounded-xl bg-[color:var(--color-surface-hover)] hover:bg-[color:var(--color-surface)] transition disabled:opacity-50"
            onClick={handleSkip}
            disabled={!identity}
          >
            Später verbinden
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
