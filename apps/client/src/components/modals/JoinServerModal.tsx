import { useMemo, useState } from 'react';
import { Loader2, Compass, Shield, Globe } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { IdentityModal } from './IdentityModal';
import { computeFingerprint, formatFingerprint, loadIdentity, type IdentityFile } from '../../auth/identity';
import { addPinnedServer, normalizeInstanceUrl } from '../../utils/pinnedServers';
import { getServerUrl, setServerUrl } from '../../utils/apiConfig';
import { ModalLayout } from './ModalLayout';
import { storage } from '../../shared/config/storage';
import { Icon } from '../ui';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

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
  const labelClassName = 'text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]';
  const helperClassName = 'text-xs text-[color:var(--color-text-muted)]';

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
      const serverIdStr = parsed.serverId;
      const serverId = Number(serverIdStr);
      if (!serverIdStr || !Number.isFinite(serverId)) {
        throw new Error('Bitte eine gültige Server-ID oder einen Invite-Link eingeben.');
      }

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
        storage.set('pendingServerId', serverId);
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
            <Button variant="ghost" size="sm" onClick={onClose} className="font-medium">
              Abbrechen
            </Button>
            <Button
              onClick={() => handleSubmit()}
              disabled={loading || !serverInput || !identity}
              variant="primary"
              className="font-semibold disabled:opacity-50 flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              {loading && <Icon icon={Loader2} size="md" tone="default" className="text-inherit animate-spin" />}
              Beitreten
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-[color:var(--color-surface-hover)] border border-[color:var(--color-border)] flex items-center justify-center text-[color:var(--color-accent)]">
              <Icon icon={Compass} size={32} tone="accent" className="text-inherit" />
            </div>
          </div>

          {error && <div className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded">{error}</div>}

          <div className="space-y-1">
            <label className={`mb-1 block ${labelClassName}`}>Invite / Server ID</label>
            <Input
              autoFocus
              type="text"
              value={serverInput}
              onChange={(e) => setServerInput(e.target.value)}
              placeholder="z.B. 1 oder https://example.com/invite/1"
              inputSize="lg"
              className="font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className={`mb-1 block flex items-center gap-2 ${labelClassName}`}>
              <Icon icon={Globe} size="sm" tone="muted" className="text-inherit" />
              Instanz URL (optional)
            </label>
            <Input
              type="text"
              value={instanceUrl}
              onChange={(e) => setInstanceUrlState(e.target.value)}
              placeholder="z.B. https://mein-server.tld"
              inputSize="lg"
              className="font-medium"
            />
            <p className={`${helperClassName} mt-1`}>Leer lassen, um die aktuelle Instanz zu nutzen.</p>
          </div>

          <div className="rounded-[var(--radius-4)] border border-[color:var(--color-border)] bg-white/[0.02] p-4 flex items-start gap-3">
            <div className="p-2 rounded-full bg-[color:var(--color-surface-hover)] text-[color:var(--color-accent)]">
              <Icon icon={Shield} size="lg" tone="accent" className="text-inherit" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-text">Clover Identity</div>
              {identity && fingerprint ? (
                <p className={`${helperClassName} mt-1 break-all`}>Fingerprint: {formatFingerprint(fingerprint)}</p>
              ) : (
                <p className={`${helperClassName} mt-1`}>Du benötigst eine Identity, um einem Server beizutreten.</p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 text-sm text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-hover)]"
                onClick={() => setShowIdentityModal(true)}
              >
                Identity verwalten
              </Button>
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
