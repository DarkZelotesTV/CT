import { useMemo, useState } from 'react';
import { Loader2, Compass, Shield, Globe } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { IdentityModal } from './IdentityModal';
import { computeFingerprint, formatFingerprint, loadIdentity, type IdentityFile } from '../../auth/identity';
import { addPinnedServer, normalizeInstanceUrl } from '../../utils/pinnedServers';
import { getServerUrl, setServerUrl } from '../../utils/apiConfig';
import { ModalLayout } from './ModalLayout';

interface JoinServerModalProps {
  onClose: () => void;
  onJoined: () => void;
}

function parseServerInput(input: string): { serverId: string; instanceUrl?: string } {
  const v = (input || '').trim();
  if (!v) return { serverId: '' };

  // URL form
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      const origin = `${u.protocol}//${u.host}`;

      // allow query params like ?serverId=123
      const qServerId = u.searchParams.get('serverId') || u.searchParams.get('id');
      if (qServerId) return { serverId: qServerId, instanceUrl: origin };

      // else try last path segment as number
      const parts = u.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && /^\d+$/.test(last)) return { serverId: last, instanceUrl: origin };

      return { serverId: '', instanceUrl: origin };
    } catch {
      // fallthrough
    }
  }

  // Raw server id
  return { serverId: v };
}

export const JoinServerModal = ({ onClose, onJoined }: JoinServerModalProps) => {
  const [serverInput, setServerInput] = useState('');
  const [instanceUrl, setInstanceUrlState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [identity, setIdentity] = useState<IdentityFile | null>(() => loadIdentity());
  const [showIdentityModal, setShowIdentityModal] = useState(!identity);

  const fingerprint = useMemo(() => (identity ? computeFingerprint(identity) : null), [identity]);

  const handleIdentityChanged = (next: IdentityFile | null) => {
    setIdentity(next);
    if (next) {
      setError('');
      setShowIdentityModal(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!identity) {
      setError('Bitte erst eine Clover Identity erstellen oder importieren.');
      setShowIdentityModal(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const parsed = parseServerInput(serverInput);
      const serverId = parsed.serverId;
      if (!serverId) throw new Error('Bitte eine gültige Server-ID oder einen Invite-Link eingeben.');

      const chosenBase = normalizeInstanceUrl(instanceUrl || parsed.instanceUrl || getServerUrl());

      const joinRes = await apiFetch<any>('/api/servers/join', {
        method: 'POST',
        body: JSON.stringify({ serverId }),
        baseUrl: chosenBase,
      });

      // If this was a remote instance, pin it so the user can switch back later.
      const current = normalizeInstanceUrl(getServerUrl());
      if (normalizeInstanceUrl(chosenBase) !== current) {
        const server = joinRes?.server;
        addPinnedServer({
          instanceUrl: chosenBase,
          serverId: Number(serverId),
          name: server?.name,
          iconUrl: server?.icon_url,
        });

        // Switch to the remote instance now
        localStorage.setItem('ct.pending_server_id', String(serverId));
        setServerUrl(chosenBase);
        window.location.reload();
        return;
      }

      onJoined();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Server nicht gefunden oder ungültige Eingabe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ModalLayout
        title="Server beitreten"
        description="Gib die Server-ID ein oder einen Einladungs-Link."
        onClose={onClose}
        bodyClassName="p-6 pt-0 space-y-4"
        footer={
          <div className="flex justify-between items-center">
            <button onClick={onClose} className="text-white hover:underline text-sm font-medium px-4">
              Abbrechen
            </button>
            <button
              onClick={() => handleSubmit()}
              disabled={loading || !serverInput || !identity}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              {loading && <Loader2 className="animate-spin" size={16} />}
              Beitreten
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-indigo-400">
              <Compass size={32} />
            </div>
          </div>

          {error && <div className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded">{error}</div>}

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Invite / Server ID</label>
            <input
              autoFocus
              type="text"
              value={serverInput}
              onChange={(e) => setServerInput(e.target.value)}
              placeholder="z.B. 1 oder https://example.com/invite/1"
              className="w-full bg-black/30 text-white p-3 rounded-xl border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-600 font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block flex items-center gap-2">
              <Globe size={14} />
              Instanz URL (optional)
            </label>
            <input
              type="text"
              value={instanceUrl}
              onChange={(e) => setInstanceUrlState(e.target.value)}
              placeholder="z.B. https://mein-server.tld"
              className="w-full bg-black/30 text-white p-3 rounded-xl border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-600 font-medium"
            />
            <p className="text-[10px] text-gray-500 mt-1">Leer lassen, um die aktuelle Instanz zu nutzen.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex items-start gap-3">
            <div className="p-2 rounded-full bg-white/5 text-indigo-400">
              <Shield size={18} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-white">Clover Identity</div>
              {identity && fingerprint ? (
                <p className="text-xs text-gray-400 mt-1 break-all">Fingerprint: {formatFingerprint(fingerprint)}</p>
              ) : (
                <p className="text-xs text-yellow-300 mt-1">Du benötigst eine Identity, um einem Server beizutreten.</p>
              )}
              <button
                type="button"
                className="mt-2 text-sm text-indigo-400 hover:text-indigo-300"
                onClick={() => setShowIdentityModal(true)}
              >
                Identity verwalten
              </button>
            </div>
          </div>
        </form>
      </ModalLayout>

      {showIdentityModal && (
        <IdentityModal onClose={() => setShowIdentityModal(false)} onIdentityChanged={handleIdentityChanged} />
      )}
    </>
  );
};
