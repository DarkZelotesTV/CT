import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getModalRoot } from './modalRoot';
import { useTopBar } from '../window/TopBarContext';
import { 
  X, 
  Trash2, 
  Shield, 
  Save, 
  Loader2, 
  Plus, 
  ArrowUp, 
  ArrowDown, 
  Settings2, 
  Hash, 
  Users, 
  Settings,
  Check,
  Globe,
  Lock,
  ListChecks,
  GripHorizontal,
  Volume2
} from 'lucide-react';
import { apiFetch } from '../../api/http';
import { CreateChannelModal } from './CreateChannelModal';
import { defaultServerTheme, deriveServerThemeFromSettings, type ServerTheme } from '../../theme/serverTheme';
import { useSettings } from '../../context/SettingsContext';

interface ServerSettingsProps {
  serverId: number;
  onClose: () => void;
  onUpdated?: (payload: { name: string; fallbackChannelId: number | null }) => void;
  onDeleted?: () => void;
}

const PERMISSIONS: { key: string; label: string }[] = [
  { key: 'speak', label: 'Sprechen' },
  { key: 'move', label: 'Verschieben' },
  { key: 'kick', label: 'Kicken' },
  { key: 'manage_channels', label: 'Kanäle verwalten' },
  { key: 'manage_roles', label: 'Rollen verwalten' },
  { key: 'manage_overrides', label: 'Kanal-Overrides' },
];

interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice' | 'web' | 'data-transfer' | 'spacer' | 'list';
  category_id?: number | null;
  position?: number;
  default_password?: string | null;
  join_password?: string | null;
}

interface Category {
  id: number;
  name: string;
  channels: Channel[];
}

export const ServerSettingsModal = ({ serverId, onClose, onUpdated, onDeleted }: ServerSettingsProps) => {
  const { slots, setSlots } = useTopBar();
  const baseSlotsRef = useRef(slots);
  const modalTitle = 'Server Einstellungen';

  useEffect(() => {
    const base = baseSlotsRef.current;
    setSlots({
      ...base,
      center: (
        <div className="px-3 py-1 rounded-md bg-white/5 border border-white/10 max-w-[720px]">
          <div className="text-[13px] text-gray-200 truncate" title={modalTitle}>
            {modalTitle}
          </div>
        </div>
      ),
    });

    return () => setSlots(base);
  }, [setSlots, modalTitle]);

  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'channels' | 'roles'>('overview');
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [serverName, setServerName] = useState('');
  const [serverDescription, setServerDescription] = useState('');
  const [fallbackChannelId, setFallbackChannelId] = useState<number | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [savingServer, setSavingServer] = useState(false);
  const [structure, setStructure] = useState<{ categories: Category[]; uncategorized: Channel[]; fallbackChannelId?: number | null }>({ categories: [], uncategorized: [], fallbackChannelId: null });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [serverTheme, setServerTheme] = useState<ServerTheme>(defaultServerTheme);
  const [serverSettings, setServerSettings] = useState<any>({});
  const [branding, setBranding] = useState<{ logoUrl: string; bannerUrl: string; accentColor: string; backgroundColor: string; tagline: string }>({
    logoUrl: '',
    bannerUrl: '',
    accentColor: defaultServerTheme.accent,
    backgroundColor: defaultServerTheme.background,
    tagline: '',
  });
  const [connectionSettings, setConnectionSettings] = useState<{ host: string; port: string; basePath: string; region: string; secure: boolean }>({
    host: '',
    port: '',
    basePath: '',
    region: '',
    secure: true,
  });
  const [newChannelType, setNewChannelType] = useState<Channel['type']>('text');
  const [selectedChannelForOverrides, setSelectedChannelForOverrides] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [selectedOverrideRole, setSelectedOverrideRole] = useState<number | null>(null);
  const [overrideDraft, setOverrideDraft] = useState<{ allow: Record<string, boolean>; deny: Record<string, boolean> }>({ allow: {}, deny: {} });

  const accentColor = useMemo(
    () => settings.theme.serverAccents?.[serverId] ?? settings.theme.accentColor,
    [serverId, settings.theme]
  );

  useEffect(() => {
    if (!serverSettings || Object.keys(serverSettings).length === 0) return;
    setServerTheme(deriveServerThemeFromSettings(serverSettings.theme || serverSettings, accentColor));
  }, [accentColor, serverSettings]);

  // Use the dedicated portal target so the modal never gets trapped behind
  // backdrop-filter stacking contexts (Electron/Chromium quirk).
  const portalTarget = getModalRoot();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Reset scroll state in case the modal prevented scroll in the future
      if (typeof document !== 'undefined') {
        document.body.style.removeProperty('overflow');
      }
    };
  }, []);

  // Prevent background scroll while the modal is visible
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, []);

  // Initial Data Loading
  useEffect(() => {
    const loadDetails = async () => {
      try {
        const res = await apiFetch<any[]>(`/api/servers`);
        const myServer = res.find((s: any) => s.id === serverId);
        if (myServer) {
          setServerName(myServer.name);
          setFallbackChannelId(myServer.fallback_channel_id ?? null);
          const nextTheme = deriveServerThemeFromSettings(
            myServer.settings || myServer.theme,
            settings.theme.serverAccents?.[serverId] ?? settings.theme.accentColor
          );
          setServerTheme(nextTheme);
          setServerSettings(myServer.settings || {});
          const connection = myServer.settings?.connection || {};
          const brandingSettings = myServer.settings?.branding || {};
          setServerDescription(myServer.settings?.description || myServer.settings?.tagline || '');
          setBranding({
            logoUrl: brandingSettings.logoUrl || '',
            bannerUrl: brandingSettings.bannerUrl || '',
            accentColor: brandingSettings.accentColor || nextTheme.accent,
            backgroundColor: brandingSettings.backgroundColor || nextTheme.background,
            tagline: brandingSettings.tagline || myServer.settings?.tagline || '',
          });
          setConnectionSettings({
            host: connection.host || '',
            port: typeof connection.port !== 'undefined' && connection.port !== null ? String(connection.port) : '',
            basePath: connection.basePath || '',
            region: connection.region || '',
            secure: typeof connection.secure === 'boolean' ? connection.secure : true,
          });
        }
      } catch (e) {}
    };
    loadDetails();
  }, [serverId]);

  useEffect(() => {
    loadStructure();
  }, [serverId]);

  useEffect(() => {
    if (activeTab === 'members') {
      loadMembers();
      loadRoles();
    }
    if (activeTab === 'channels') loadStructure();
    if (activeTab === 'roles') loadRoles();
  }, [activeTab]);

  useEffect(() => {
    if (selectedChannelForOverrides) {
      loadOverrides(selectedChannelForOverrides);
    }
  }, [selectedChannelForOverrides]);

  useEffect(() => {
    setServerTheme((prev) => ({
      ...prev,
      accent: branding.accentColor || prev.accent,
      background: branding.backgroundColor || prev.background,
    }));
  }, [branding.accentColor, branding.backgroundColor]);

  useEffect(() => {
    if (overrides.length && roles.length) {
      const roleId = overrides[0]?.role_id || roles[0]?.id;
      setSelectedOverrideRole(roleId || null);
      const current = overrides.find((o) => o.role_id === roleId);
      setOverrideDraft({ allow: current?.allow || {}, deny: current?.deny || {} });
    }
  }, [overrides, roles]);

  // Data Fetchers
  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const res = await apiFetch<any[]>(`/api/servers/${serverId}/members`);
      setMembers(res);
    } catch (e) {
      console.error(e);
    }
    setLoadingMembers(false);
  };

  const loadRoles = async () => {
    try {
      const res = await apiFetch<any[]>(`/api/servers/${serverId}/roles`);
      setRoles(res);
    } catch (e) {
      console.error(e);
    }
  };

  const loadStructure = async () => {
    try {
      const res = await apiFetch<{ categories: Category[]; uncategorized: Channel[]; fallbackChannelId?: number | null }>(`/api/servers/${serverId}/structure`);
      setStructure(res);
      if (typeof res.fallbackChannelId !== 'undefined') {
        setFallbackChannelId(res.fallbackChannelId ?? null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadOverrides = async (channelId: number) => {
    try {
      const res = await apiFetch<any[]>(`/api/channels/${channelId}/overrides`);
      setOverrides(res);
    } catch (e) {
      console.error(e);
    }
  };

  // Actions
  const handleSaveServer = async () => {
    setSavingServer(true);
    try {
      const portValue = connectionSettings.port.trim() ? Number(connectionSettings.port) : null;
      const settingsPayload = {
        ...serverSettings,
        description: serverDescription,
        tagline: branding.tagline || serverDescription,
        branding,
        connection: { ...connectionSettings, port: Number.isNaN(portValue) ? null : portValue },
        theme: { ...serverTheme, accent: branding.accentColor, background: branding.backgroundColor },
      };

      await apiFetch(`/api/servers/${serverId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: serverName, fallbackChannelId, settings: settingsPayload }),
      });
      await loadStructure();
      onUpdated?.({ name: serverName, fallbackChannelId });
      onClose();
    } catch (e) {
      alert('Fehler beim Speichern');
    } finally {
      setSavingServer(false);
    }
  };

  const handleKick = async (userId: number) => {
    if (!confirm('Diesen Nutzer wirklich kicken?')) return;
    try {
      await apiFetch(`/api/servers/${serverId}/members/${userId}`, { method: 'DELETE' });
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (e) {
      alert('Konnte User nicht kicken (Fehlende Rechte?)');
    }
  };

  const handleDeleteServer = async () => {
    const name = prompt('Tippe den Servernamen zum Löschen:');
    if (name !== serverName) return alert('Name stimmt nicht überein.');

    try {
      await apiFetch(`/api/servers/${serverId}`, { method: 'DELETE' });
      onDeleted?.();
      onClose();
    } catch (e) {
      alert('Fehler beim Löschen.');
    }
  };

  const updateMemberRoles = async (userId: number, roleIds: number[]) => {
    try {
      await apiFetch(`/api/servers/${serverId}/members/${userId}/roles`, { method: 'PUT', body: JSON.stringify({ roleIds }) });
      loadMembers();
    } catch (e) {
      alert('Konnte Rollen nicht speichern');
    }
  };

  const toggleRolePermission = async (role: any, perm: string) => {
    const nextPermissions = { ...(role.permissions || {}) };
    nextPermissions[perm] = !nextPermissions[perm];

    try {
      const updated = await apiFetch<any>(`/api/servers/${serverId}/roles/${role.id}`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: nextPermissions }),
      });
      setRoles((prev) => prev.map((r) => (r.id === role.id ? updated : r)));
    } catch (e) {
      alert('Konnte Rolle nicht aktualisieren');
    }
  };

  const createRole = async () => {
    const name = prompt('Rollenname?');
    if (!name) return;
    try {
      const role = await apiFetch<any>(`/api/servers/${serverId}/roles`, {
        method: 'POST',
        body: JSON.stringify({ name, position: roles.length, permissions: {} }),
      });
      setRoles((prev) => [...prev, role]);
    } catch (e) {
      alert('Konnte Rolle nicht erstellen');
    }
  };

  const deleteRole = async (roleId: number) => {
    if (!confirm('Rolle wirklich löschen?')) return;
    try {
      await apiFetch(`/api/servers/${serverId}/roles/${roleId}`, { method: 'DELETE' });
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
    } catch (e) {
      alert('Konnte Rolle nicht löschen');
    }
  };

  const saveChannel = async (channel: Channel) => {
    try {
      await apiFetch(`/api/channels/${channel.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: channel.name,
          type: channel.type,
          categoryId: channel.category_id,
          position: channel.position,
          defaultPassword: channel.default_password,
          joinPassword: channel.join_password,
        }),
      });
      loadStructure();
    } catch (e) {
      alert('Konnte Kanal nicht speichern');
    }
  };

  const moveChannel = async (channels: Channel[], index: number, dir: number, categoryId?: number | null) => {
    const targetIndex = index + dir;
    if (targetIndex < 0 || targetIndex >= channels.length) return;
    const a = channels[index];
    const b = channels[targetIndex];
    if (!a || !b) return;

    const updates = [
      { id: a.id, position: b.position ?? targetIndex, categoryId },
      { id: b.id, position: a.position ?? index, categoryId },
    ];

    try {
      await apiFetch(`/api/servers/${serverId}/channels/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ updates }),
      });
      loadStructure();
    } catch (e) {
      alert('Konnte Reihenfolge nicht speichern');
    }
  };

  const saveOverride = async () => {
    if (!selectedChannelForOverrides || !selectedOverrideRole) return;
    try {
      await apiFetch(`/api/channels/${selectedChannelForOverrides}/overrides`, {
        method: 'PUT',
        body: JSON.stringify({ roleId: selectedOverrideRole, allow: overrideDraft.allow, deny: overrideDraft.deny }),
      });
      loadOverrides(selectedChannelForOverrides);
      alert('Override gespeichert');
    } catch (e) {
      alert('Konnte Override nicht speichern');
    }
  };

  const overridePermissions = useMemo(() => {
    return overrides.reduce<Record<number, { allow: Record<string, boolean>; deny: Record<string, boolean> }>>((acc, curr) => {
      acc[curr.role_id] = { allow: curr.allow || {}, deny: curr.deny || {} };
      return acc;
    }, {});
  }, [overrides]);

  const currentOverride = selectedOverrideRole ? overridePermissions[selectedOverrideRole] : undefined;

  useEffect(() => {
    if (selectedChannelForOverrides && roles.length && !selectedOverrideRole) {
      const fallbackRole = roles[0];
      setSelectedOverrideRole(fallbackRole?.id ?? null);
      const current = fallbackRole ? overridePermissions[fallbackRole.id] : null;
      setOverrideDraft({ allow: current?.allow || {}, deny: current?.deny || {} });
    }
  }, [overridePermissions, roles, selectedChannelForOverrides, selectedOverrideRole]);

  const tabs = [
    { key: 'overview', label: 'Übersicht', icon: Settings },
    { key: 'channels', label: 'Kanäle', icon: Hash },
    { key: 'roles', label: 'Rollen', icon: Shield },
    { key: 'members', label: 'Mitglieder', icon: Users },
  ];

  if (!portalTarget) return null;

  return createPortal(
    <div
      className="fixed left-0 right-0 bottom-0 top-[var(--ct-titlebar-height)] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 relative"
      style={{ zIndex: 9999, transform: 'translateZ(0)', willChange: 'transform' }}
    >
      {/* Desktop Responsive Container: Wächst mit, maximale Breite begrenzt, fixe Höhe für konsistentes Layout */}
      <div className="bg-[#0f1014] w-11/12 max-w-5xl h-[85vh] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
          <div>
            <div className="text-xs uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Settings2 size={14} /> Server Management
            </div>
            <h2 className="text-2xl font-bold text-white">{modalTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {/* Responsive Grid: Sidebar links auf Desktop, oben scrollbar auf Mobile */}
          <div className="grid grid-cols-1 md:grid-cols-[240px,1fr] gap-0 h-full">
            
            {/* Sidebar Navigation */}
            <nav className="bg-white/5 border-b md:border-b-0 md:border-r border-white/10 p-3 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shrink-0 md:shrink">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition border w-auto md:w-full whitespace-nowrap text-left flex-shrink-0 ${
                    activeTab === tab.key
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100'
                      : 'border-transparent text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                </button>
              ))}
              
              <div className="md:mt-auto pt-0 md:pt-4 border-l md:border-l-0 md:border-t border-white/10 ml-2 md:ml-0 pl-2 md:pl-0 flex items-center md:block">
                <button
                  onClick={handleDeleteServer}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition border border-transparent w-auto md:w-full whitespace-nowrap text-left text-red-400 hover:bg-red-500/10 hover:border-red-500/30"
                >
                  <Trash2 size={16} />
                  <span className="hidden md:inline">Server löschen</span>
                  <span className="md:hidden">Löschen</span>
                </button>
              </div>
            </nav>

            {/* Main Content Area */}
            <div className="p-6 overflow-y-auto custom-scrollbar h-full">
              
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Serverprofil</div>
                    <p className="text-gray-400 text-sm">Strukturiere die wichtigsten Server-Informationen im zweispaltigen Desktop-Layout.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="p-4 rounded-2xl border border-white/10 bg-white/5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Identität</div>
                          <div className="text-lg font-semibold text-white">Brand Basics</div>
                        </div>
                        <span className="text-[11px] px-2 py-1 rounded-full bg-white/10 text-gray-300 border border-white/10">Desktop-first</span>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-xs text-gray-400 uppercase font-semibold">Servername</label>
                          <input
                            type="text"
                            value={serverName}
                            onChange={(e) => setServerName(e.target.value)}
                            className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                            placeholder="Mein cooler Server"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-gray-400 uppercase font-semibold">Tagline</label>
                          <input
                            type="text"
                            value={branding.tagline}
                            onChange={(e) => setBranding((prev) => ({ ...prev, tagline: e.target.value }))}
                            className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                            placeholder="Kurzer Claim für den Server"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-gray-400 uppercase font-semibold">Beschreibung</label>
                          <textarea
                            value={serverDescription}
                            onChange={(e) => setServerDescription(e.target.value)}
                            rows={4}
                            className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
                            placeholder="Was erwartet Mitglieder hier?"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-white/10 bg-white/5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Verbindung</div>
                          <div className="text-lg font-semibold text-white">Routing & Fallback</div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Globe size={14} />
                          <span>Desktop optimiert</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-xs text-gray-400 uppercase font-semibold">Host</label>
                          <input
                            value={connectionSettings.host}
                            onChange={(e) => setConnectionSettings((prev) => ({ ...prev, host: e.target.value }))}
                            className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                            placeholder="ct.example.local"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-gray-400 uppercase font-semibold">Port</label>
                          <input
                            value={connectionSettings.port}
                            onChange={(e) => setConnectionSettings((prev) => ({ ...prev, port: e.target.value }))}
                            className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                            placeholder="443"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-gray-400 uppercase font-semibold">Basis-Pfad</label>
                          <input
                            value={connectionSettings.basePath}
                            onChange={(e) => setConnectionSettings((prev) => ({ ...prev, basePath: e.target.value }))}
                            className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                            placeholder="/api"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-gray-400 uppercase font-semibold">Region</label>
                          <input
                            value={connectionSettings.region}
                            onChange={(e) => setConnectionSettings((prev) => ({ ...prev, region: e.target.value }))}
                            className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                            placeholder="eu-central"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-gray-300">
                          <input
                            type="checkbox"
                            checked={connectionSettings.secure}
                            onChange={(e) => setConnectionSettings((prev) => ({ ...prev, secure: e.target.checked }))}
                            className="w-4 h-4 rounded border border-white/20 bg-black/20"
                          />
                          TLS / HTTPS erzwingen
                        </label>
                        <div className="flex-1 text-right text-[11px] text-gray-500">Sichere Verbindungen werden bevorzugt.</div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-gray-400 uppercase font-semibold">Fallback-Kanal</label>
                        <select
                          value={fallbackChannelId ?? ''}
                          onChange={(e) => setFallbackChannelId(e.target.value ? Number(e.target.value) : null)}
                          className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                        >
                          <option value="">Keiner</option>
                          {[...structure.uncategorized, ...structure.categories.flatMap((c) => c.channels)]
                            .filter((c) => c.type !== 'voice' && c.type !== 'spacer')
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.type === 'web' ? 'Web' : c.type === 'list' ? 'Liste' : c.type === 'data-transfer' ? 'Transfer' : 'Text'})
                              </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-gray-500 leading-relaxed">
                          Wird automatisch geöffnet, wenn Mitglieder dem Server beitreten oder einen Sprachkanal verlassen.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="p-4 rounded-2xl border border-white/10 bg-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Branding</div>
                          <div className="text-lg font-semibold text-white">Farben & Medien</div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Settings size={14} />
                          <span>Style Guide</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-xs text-gray-400 uppercase font-semibold">Akzentfarbe</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={branding.accentColor}
                              onChange={(e) => setBranding((prev) => ({ ...prev, accentColor: e.target.value }))}
                              className="w-12 h-10 bg-black/40 rounded-lg border border-white/10"
                            />
                            <input
                              type="text"
                              value={branding.accentColor}
                              onChange={(e) => setBranding((prev) => ({ ...prev, accentColor: e.target.value }))}
                              className="flex-1 bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                              placeholder="#6366f1"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-gray-400 uppercase font-semibold">Hintergrund</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={branding.backgroundColor}
                              onChange={(e) => setBranding((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                              className="w-12 h-10 bg-black/40 rounded-lg border border-white/10"
                            />
                            <input
                              type="text"
                              value={branding.backgroundColor}
                              onChange={(e) => setBranding((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                              className="flex-1 bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                              placeholder="#050507"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-xs text-gray-400 uppercase font-semibold">Logo-URL</label>
                          <input
                            type="text"
                            value={branding.logoUrl}
                            onChange={(e) => setBranding((prev) => ({ ...prev, logoUrl: e.target.value }))}
                            className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                            placeholder="https://.../logo.png"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs text-gray-400 uppercase font-semibold">Banner-URL</label>
                          <input
                            type="text"
                            value={branding.bannerUrl}
                            onChange={(e) => setBranding((prev) => ({ ...prev, bannerUrl: e.target.value }))}
                            className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                            placeholder="https://.../banner.jpg"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500">Links können leer bleiben – bestehende Assets bleiben erhalten.</p>
                    </div>

                    <div className="p-4 rounded-2xl border border-white/10 bg-white/5 space-y-4 flex flex-col">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Vorschau</div>
                          <div className="text-lg font-semibold text-white">Branding & Routing</div>
                        </div>
                        <ListChecks size={16} className="text-gray-400" />
                      </div>

                      <div
                        className="flex-1 rounded-2xl border border-white/10 overflow-hidden shadow-inner"
                        style={{ background: branding.backgroundColor }}
                      >
                        <div className="p-4 flex flex-col gap-3 h-full" style={{ backgroundImage: branding.bannerUrl ? `linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.75)), url(${branding.bannerUrl})` : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.3))', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden">
                              {branding.logoUrl ? (
                                <img src={branding.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-white text-sm font-bold">{serverName?.[0]?.toUpperCase() || 'S'}</span>
                              )}
                            </div>
                            <div>
                              <div className="text-white font-semibold text-lg">{serverName || 'Servername'}</div>
                              <div className="text-gray-300 text-sm" style={{ color: branding.accentColor }}>
                                {branding.tagline || 'Kurzer Claim für deinen Server'}
                              </div>
                            </div>
                          </div>

                          <div className="mt-auto space-y-2 text-sm text-gray-300">
                            <div className="flex items-center gap-2">
                              <Globe size={14} />
                              <span>{connectionSettings.host || 'host.local'}{connectionSettings.port ? `:${connectionSettings.port}` : ''}{connectionSettings.basePath || ''}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Shield size={14} />
                              <span>{connectionSettings.secure ? 'TLS aktiv' : 'Ohne TLS'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500">Passe Farben und Verbindungsdetails an und prüfe die Darstellung live.</p>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-3">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleSaveServer}
                      disabled={savingServer}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center gap-2 transition-colors"
                    >
                      {savingServer ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Speichern
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'members' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Mitglieder ({members.length})</div>
                      <p className="text-gray-400 text-sm">Verwalte Rollen und Zugriff.</p>
                    </div>
                    <button
                      onClick={loadMembers}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white flex items-center gap-2"
                    >
                      <Loader2 size={14} className={loadingMembers ? "animate-spin" : ""} /> Refresh
                    </button>
                  </div>

                  <div className="space-y-3">
                    {members.map((m: any) => (
                      <div key={m.userId} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-cyan-900/40 border border-cyan-600/40 flex items-center justify-center text-cyan-300 font-bold text-sm">
                            {m.username?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">{m.username}</div>
                            <div className="text-[11px] text-gray-500 uppercase tracking-wider">Status: {m.status}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                          <select
                            multiple
                            value={m.roles?.map((r: any) => r.id) || []}
                            onChange={(e) => {
                              const values = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
                              updateMemberRoles(m.userId, values);
                            }}
                            className="bg-black/40 text-white text-xs rounded-xl px-3 py-2 border border-white/10 focus:border-cyan-500 outline-none min-w-[140px] flex-1 md:flex-none h-10"
                          >
                            {roles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleKick(m.userId)}
                            className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 transition-colors"
                            title="Kicken"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'channels' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Struktur</div>
                      <p className="text-gray-400 text-sm">Kanäle, Kategorien und Passwörter.</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <select
                        value={newChannelType}
                        onChange={(e) => setNewChannelType(e.target.value as any)}
                        className="bg-black/40 text-white text-sm px-3 py-2 rounded-xl border border-white/10 outline-none"
                      >
                        <option value="text">Text</option>
                        <option value="voice">Voice</option>
                        <option value="web">Web</option>
                        <option value="list">Liste</option>
                        <option value="data-transfer">Daten-Transfer</option>
                        <option value="spacer">Trenner</option>
                      </select>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded-xl text-white flex items-center gap-2 text-sm transition-colors"
                      >
                        <Plus size={16} /> Kanal
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Uncategorized */}
                    {structure.uncategorized.length > 0 && (
                       <div className="space-y-2">
                          <div className="text-[10px] uppercase text-gray-600 font-bold px-1">Ohne Kategorie</div>
                          {structure.uncategorized.map((c, idx) => (
                             <ChannelEditor 
                                key={c.id} 
                                channel={c} 
                                idx={idx} 
                                list={structure.uncategorized} 
                                onMove={(i, d) => moveChannel(structure.uncategorized, i, d, null)}
                                onSave={(ch) => saveChannel(ch)}
                                onChange={(updated) => setStructure(prev => ({...prev, uncategorized: prev.uncategorized.map(ch => ch.id === c.id ? updated : ch)}))}
                                onSelectOverrides={setSelectedChannelForOverrides}
                             />
                          ))}
                       </div>
                    )}

                    {/* Categories */}
                    {structure.categories.map((cat) => (
                      <div key={cat.id} className="space-y-2">
                        <div className="text-[10px] uppercase text-gray-500 font-bold px-1 flex items-center gap-2">
                           <span>{cat.name}</span>
                           <span className="px-1.5 py-0.5 rounded bg-white/5 text-gray-500 text-[9px]">{cat.channels.length}</span>
                        </div>
                        {cat.channels.map((c, idx) => (
                           <ChannelEditor 
                              key={c.id} 
                              channel={c} 
                              idx={idx} 
                              list={cat.channels}
                              onMove={(i, d) => moveChannel(cat.channels, i, d, cat.id)}
                              onSave={(ch) => saveChannel({...ch, category_id: cat.id})}
                              onChange={(updated) => setStructure(prev => ({
                                ...prev, 
                                categories: prev.categories.map(cg => cg.id === cat.id ? {...cg, channels: cg.channels.map(ch => ch.id === c.id ? updated : ch)} : cg)
                              }))}
                              onSelectOverrides={setSelectedChannelForOverrides}
                           />
                        ))}
                      </div>
                    ))}
                  </div>

                  {selectedChannelForOverrides && (
                    <div className="mt-8 border-t border-white/10 pt-6 space-y-4 animate-in slide-in-from-bottom-4">
                      <div className="flex items-center gap-2 text-cyan-400">
                        <Settings2 size={18} />
                        <span className="font-bold text-sm">Overrides für Kanal #{selectedChannelForOverrides}</span>
                      </div>
                      
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                        <div className="flex gap-3">
                            <select
                              value={selectedOverrideRole || ''}
                              onChange={(e) => {
                                const id = Number(e.target.value);
                                setSelectedOverrideRole(id);
                                const current = overridePermissions[id];
                                setOverrideDraft({ allow: current?.allow || {}, deny: current?.deny || {} });
                              }}
                              className="bg-black/40 text-white text-sm px-3 py-2 rounded-xl border border-white/10 outline-none flex-1"
                            >
                              {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={saveOverride}
                              className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2"
                            >
                              <Save size={16} /> Speichern
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                           {PERMISSIONS.map((p) => (
                              <div key={p.key} className="bg-black/20 rounded-xl p-3 border border-white/5">
                                 <div className="text-xs text-gray-400 uppercase font-semibold mb-2">{p.label}</div>
                                 <div className="flex gap-3 text-xs">
                                    <label className={`flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg border transition-colors ${overrideDraft.allow[p.key] ? 'bg-green-500/20 border-green-500/50 text-green-200' : 'border-transparent text-gray-500 hover:bg-white/5'}`}>
                                       <input
                                          type="checkbox"
                                          className="hidden"
                                          checked={overrideDraft.allow[p.key] || false}
                                          onChange={(e) => setOverrideDraft((prev) => ({ ...prev, allow: { ...prev.allow, [p.key]: e.target.checked } }))}
                                       />
                                       <Check size={12} className={overrideDraft.allow[p.key] ? "opacity-100" : "opacity-0"} />
                                       Allow
                                    </label>
                                    <label className={`flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg border transition-colors ${overrideDraft.deny[p.key] ? 'bg-red-500/20 border-red-500/50 text-red-200' : 'border-transparent text-gray-500 hover:bg-white/5'}`}>
                                       <input
                                          type="checkbox"
                                          className="hidden"
                                          checked={overrideDraft.deny[p.key] || false}
                                          onChange={(e) => setOverrideDraft((prev) => ({ ...prev, deny: { ...prev.deny, [p.key]: e.target.checked } }))}
                                       />
                                       <X size={12} className={overrideDraft.deny[p.key] ? "opacity-100" : "opacity-0"} />
                                       Deny
                                    </label>
                                 </div>
                              </div>
                           ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'roles' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between">
                     <div>
                      <div className="text-xs uppercase tracking-widest text-gray-500 font-bold">Rollen & Rechte</div>
                      <p className="text-gray-400 text-sm">Definiere Hierarchie und Berechtigungen.</p>
                    </div>
                    <button
                      onClick={createRole}
                      className="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded-xl text-white flex items-center gap-2 text-sm transition-colors"
                    >
                      <Plus size={16} /> Neue Rolle
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {roles.map((role) => (
                      <div key={role.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                           <div className="flex items-center gap-3 flex-1">
                              <Shield size={20} className="text-cyan-400" />
                              <input
                                 value={role.name}
                                 onChange={(e) => setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, name: e.target.value } : r)))}
                                 onBlur={(e) =>
                                    apiFetch(`/api/servers/${serverId}/roles/${role.id}`, {
                                       method: 'PUT',
                                       body: JSON.stringify({ name: e.target.value }),
                                    })
                                 }
                                 className="bg-transparent text-white font-bold text-lg border-b border-transparent focus:border-cyan-500 outline-none w-full md:w-auto hover:border-white/20 transition-colors"
                              />
                           </div>
                           {!role.is_default && (
                              <button onClick={() => deleteRole(role.id)} className="text-red-400 hover:text-red-300 text-xs px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10">
                                 Löschen
                              </button>
                           )}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                           {PERMISSIONS.map((p) => (
                              <label key={p.key} className={`flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all ${role.permissions?.[p.key] ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}>
                                 <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${role.permissions?.[p.key] ? 'bg-cyan-500 border-cyan-500' : 'border-gray-500'}`}>
                                    {role.permissions?.[p.key] && <Check size={10} className="text-black" strokeWidth={3} />}
                                 </div>
                                 <input type="checkbox" className="hidden" checked={role.permissions?.[p.key] || false} onChange={() => toggleRolePermission(role, p.key)} />
                                 <span className={`text-xs ${role.permissions?.[p.key] ? 'text-cyan-100' : 'text-gray-400'}`}>{p.label}</span>
                              </label>
                           ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-white/5 shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Check size={14} className="text-green-400" />
            Änderungen werden teilweise sofort wirksam.
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            Schließen
          </button>
        </div>

      </div>
      {showCreateModal && (
        <CreateChannelModal
          serverId={serverId!}
          defaultType={newChannelType}
          theme={serverTheme}
          onClose={() => setShowCreateModal(false)}
          onCreated={loadStructure}
        />
      )}
    </div>,
    portalTarget
  );
};

// Helper Component for Channels to reduce clutter
const ChannelEditor = ({ 
   channel, 
   idx, 
   list, 
   onMove, 
   onSave, 
   onChange, 
   onSelectOverrides 
}: { 
   channel: Channel, 
   idx: number, 
   list: any[], 
   onMove: (idx: number, dir: number) => void,
   onSave: (ch: Channel) => void,
   onChange: (ch: Channel) => void,
   onSelectOverrides: (id: number) => void
}) => {
   return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-3 transition hover:bg-white/[0.07]">
         <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <div className="flex items-center gap-2 flex-1">
               <span className="text-gray-500">
                  {channel.type === 'voice' ? (
                    <Volume2 size={16} />
                  ) : channel.type === 'web' ? (
                    <Globe size={16} />
                  ) : channel.type === 'data-transfer' ? (
                    <Lock size={16} />
                  ) : channel.type === 'list' ? (
                    <ListChecks size={16} />
                  ) : channel.type === 'spacer' ? (
                    <GripHorizontal size={16} />
                  ) : (
                    <Hash size={16} />
                  )}
               </span>
               <input
                  value={channel.name}
                  onChange={(e) => onChange({...channel, name: e.target.value})}
                  className="bg-transparent text-white text-sm font-medium border-b border-transparent focus:border-cyan-500 outline-none w-full"
               />
            </div>
            
            <div className="flex items-center gap-1">
               <button onClick={() => onMove(idx, -1)} disabled={idx === 0} className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30">
                  <ArrowUp size={14} />
               </button>
               <button onClick={() => onMove(idx, 1)} disabled={idx === list.length - 1} className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30">
                  <ArrowDown size={14} />
               </button>
               <div className="w-px h-4 bg-white/10 mx-1"></div>
               <button onClick={() => onSelectOverrides(channel.id)} className="p-1.5 text-gray-500 hover:text-cyan-400" title="Rechte">
                  <Settings2 size={14} />
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
             <label className="space-y-1">
               <span className="text-[10px] uppercase text-gray-500 font-bold">Typ</span>
               <select
                  value={channel.type}
                  onChange={(e) => onChange({...channel, type: e.target.value as any})}
                  className="w-full bg-black/30 text-white text-xs px-2 py-1.5 rounded-lg border border-white/10 outline-none"
               >
                  <option value="text">Text</option>
                  <option value="voice">Voice</option>
                  <option value="web">Web</option>
                  <option value="list">Liste</option>
                  <option value="data-transfer">Daten-Transfer</option>
                  <option value="spacer">Trenner</option>
               </select>
            </label>
             <label className="space-y-1">
               <span className="text-[10px] uppercase text-gray-500 font-bold">PW (Standard)</span>
               <input
                  value={channel.default_password || ''}
                  onChange={(e) => onChange({...channel, default_password: e.target.value})}
                  className="w-full bg-black/30 text-white text-xs px-2 py-1.5 rounded-lg border border-white/10 outline-none"
                  placeholder={channel.type === 'spacer' ? 'Nicht notwendig' : '-'}
                  disabled={channel.type === 'spacer'}
               />
             </label>
              <label className="space-y-1">
               <span className="text-[10px] uppercase text-gray-500 font-bold">PW (Join)</span>
               <input
                  value={channel.join_password || ''}
                  onChange={(e) => onChange({...channel, join_password: e.target.value})}
                  className="w-full bg-black/30 text-white text-xs px-2 py-1.5 rounded-lg border border-white/10 outline-none"
                  placeholder={channel.type === 'spacer' ? 'Nicht notwendig' : '-'}
                  disabled={channel.type === 'spacer'}
               />
              </label>
         </div>
         
         <div className="flex justify-end pt-1">
            <button
               onClick={() => onSave(channel)}
               className="text-xs bg-white/5 hover:bg-green-500/20 text-gray-300 hover:text-green-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
               <Save size={12} /> Speichern
            </button>
         </div>
      </div>
   )
}
