import { useState, useEffect, useMemo } from 'react';
import { X, Trash2, Shield, Save, Loader2, Plus, ArrowUp, ArrowDown, Settings2 } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { CreateChannelModal } from './CreateChannelModal';

interface ServerSettingsProps {
  serverId: number;
  onClose: () => void;
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
  type: 'text' | 'voice' | 'web';
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

export const ServerSettingsModal = ({ serverId, onClose }: ServerSettingsProps) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'channels' | 'roles'>('overview');
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [serverName, setServerName] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [structure, setStructure] = useState<{ categories: Category[]; uncategorized: Channel[] }>({ categories: [], uncategorized: [] });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice' | 'web'>('text');
  const [selectedChannelForOverrides, setSelectedChannelForOverrides] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [selectedOverrideRole, setSelectedOverrideRole] = useState<number | null>(null);
  const [overrideDraft, setOverrideDraft] = useState<{ allow: Record<string, boolean>; deny: Record<string, boolean> }>({ allow: {}, deny: {} });

  useEffect(() => {
    const loadDetails = async () => {
      try {
        const res = await apiFetch<any[]>(`/api/servers`);
        const myServer = res.find((s: any) => s.id === serverId);
        if (myServer) setServerName(myServer.name);
      } catch (e) {}
    };
    loadDetails();
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
    if (overrides.length && roles.length) {
      const roleId = overrides[0]?.role_id || roles[0]?.id;
      setSelectedOverrideRole(roleId || null);
      const current = overrides.find((o) => o.role_id === roleId);
      setOverrideDraft({ allow: current?.allow || {}, deny: current?.deny || {} });
    }
  }, [overrides, roles]);

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
      const res = await apiFetch<{ categories: Category[]; uncategorized: Channel[] }>(`/api/servers/${serverId}/structure`);
      setStructure(res);
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

  const handleSaveServer = async () => {
    try {
      await apiFetch(`/api/servers/${serverId}`, { method: 'PUT', body: JSON.stringify({ name: serverName }) });
      alert('Server gespeichert!');
      window.location.reload();
    } catch (e) {
      alert('Fehler beim Speichern');
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
      window.location.reload();
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

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center animate-in fade-in">
      <div className="bg-dark-100 w-[980px] h-[650px] rounded-lg shadow-2xl flex overflow-hidden border border-dark-400">

        {/* Sidebar */}
        <div className="w-64 bg-dark-200 p-4 flex flex-col">
           <h2 className="font-bold text-gray-400 uppercase text-xs mb-4 px-2">Einstellungen</h2>
           <div onClick={() => setActiveTab('overview')} className={`px-2 py-1.5 rounded cursor-pointer mb-1 ${activeTab === 'overview' ? 'bg-dark-300 text-white' : 'text-gray-400 hover:bg-dark-300'}`}>Übersicht</div>
           <div onClick={() => setActiveTab('channels')} className={`px-2 py-1.5 rounded cursor-pointer mb-1 ${activeTab === 'channels' ? 'bg-dark-300 text-white' : 'text-gray-400 hover:bg-dark-300'}`}>Kanäle & Passwörter</div>
           <div onClick={() => setActiveTab('roles')} className={`px-2 py-1.5 rounded cursor-pointer mb-1 ${activeTab === 'roles' ? 'bg-dark-300 text-white' : 'text-gray-400 hover:bg-dark-300'}`}>Rollen & Rechte</div>
           <div onClick={() => setActiveTab('members')} className={`px-2 py-1.5 rounded cursor-pointer mb-1 ${activeTab === 'members' ? 'bg-dark-300 text-white' : 'text-gray-400 hover:bg-dark-300'}`}>Mitglieder</div>

           <div className="mt-auto pt-4 border-t border-dark-400">
              <div onClick={handleDeleteServer} className="text-red-400 px-2 py-1.5 rounded cursor-pointer hover:bg-red-500/10 flex items-center gap-2">
                 <Trash2 size={16} /> Server löschen
              </div>
           </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-dark-100 p-8 relative overflow-hidden">
           <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white flex flex-col items-center">
              <div className="border-2 border-gray-400 rounded-full p-1 mb-1"><X size={16}/></div>
              <span className="text-[10px] uppercase font-bold">Esc</span>
           </button>

           {activeTab === 'overview' && (
             <div className="space-y-6 max-w-xl">
                <h1 className="text-2xl font-bold text-white">Server Übersicht</h1>
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Servername</label>
                    <input
                        type="text"
                        value={serverName}
                        onChange={e => setServerName(e.target.value)}
                        className="w-full bg-dark-300 p-2 rounded text-white outline-none border border-dark-400 focus:border-blue-500 transition-colors"
                    />
                </div>
                <button onClick={handleSaveServer} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium flex items-center gap-2">
                    <Save size={18} /> Speichern
                </button>
             </div>
           )}

           {activeTab === 'members' && (
             <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-2xl font-bold text-white">Mitglieder ({members.length})</h1>
                  <button onClick={loadMembers} className="text-xs bg-dark-300 px-3 py-1 rounded text-gray-300 hover:text-white flex items-center gap-2"><Loader2 size={14} className="animate-spin"/>Refresh</button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                   {loadingMembers ? <Loader2 className="animate-spin text-white mx-auto"/> : members.map((m: any) => (
                      <div key={m.userId} className="p-3 rounded-lg bg-dark-200 border border-dark-400">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                               <div className="w-9 h-9 rounded-full bg-gray-500 flex items-center justify-center text-white font-bold">
                                  {m.username?.[0] || '?'}
                               </div>
                               <div>
                                 <div className="font-bold text-white">{m.username}</div>
                                 <div className="text-xs text-gray-500">Status: {m.status}</div>
                               </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                multiple
                                value={m.roles?.map((r: any) => r.id) || []}
                                onChange={(e) => {
                                  const values = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
                                  updateMemberRoles(m.userId, values);
                                }}
                                className="bg-dark-300 text-white text-xs rounded px-2 py-1 border border-dark-400 min-w-[140px]"
                              >
                                {roles.map((r) => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                              <button onClick={() => handleKick(m.userId)} className="text-xs bg-dark-300 hover:text-red-400 px-3 py-1 rounded transition-colors">Kicken</button>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
           )}

           {activeTab === 'channels' && (
             <div className="h-full flex flex-col gap-4 overflow-y-auto pr-2">
               <div className="flex items-center justify-between">
                 <h1 className="text-2xl font-bold text-white">Kanäle verwalten</h1>
                 <div className="flex items-center gap-2">
                   <select value={newChannelType} onChange={(e) => setNewChannelType(e.target.value as any)} className="bg-dark-300 text-white text-sm px-2 py-1 rounded border border-dark-400">
                     <option value="text">Text</option>
                     <option value="voice">Voice</option>
                     <option value="web">Web</option>
                   </select>
                   <button onClick={() => setShowCreateModal(true)} className="bg-primary px-3 py-1 rounded text-white flex items-center gap-2 text-sm">
                     <Plus size={16}/> Neuer Kanal
                   </button>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <h3 className="text-gray-400 text-xs uppercase font-bold">Ohne Kategorie</h3>
                   {structure.uncategorized.map((c, idx) => (
                     <div key={c.id} className="bg-dark-200 border border-dark-400 rounded p-3 space-y-2">
                       <div className="flex items-center justify-between">
                         <input value={c.name} onChange={(e) => {
                           const val = e.target.value;
                           setStructure((prev) => ({
                             ...prev,
                             uncategorized: prev.uncategorized.map((ch) => ch.id === c.id ? { ...ch, name: val } : ch),
                             categories: prev.categories,
                           }));
                         }} className="bg-dark-300 text-white px-2 py-1 rounded text-sm border border-dark-400" />
                         <div className="flex items-center gap-1">
                           <button onClick={() => moveChannel(structure.uncategorized, idx, -1, null)} className="p-1 text-gray-400 hover:text-white"><ArrowUp size={14}/></button>
                           <button onClick={() => moveChannel(structure.uncategorized, idx, 1, null)} className="p-1 text-gray-400 hover:text-white"><ArrowDown size={14}/></button>
                           <button onClick={() => setSelectedChannelForOverrides(c.id)} className="p-1 text-gray-400 hover:text-white" title="Overrides"><Settings2 size={14}/></button>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                         <label className="space-y-1">
                           <span className="block text-[10px] uppercase text-gray-500">Typ</span>
                           <select value={c.type} onChange={(e) => setStructure((prev) => ({
                             ...prev,
                             uncategorized: prev.uncategorized.map((ch) => ch.id === c.id ? { ...ch, type: e.target.value as any } : ch),
                             categories: prev.categories,
                           }))} className="bg-dark-300 text-white px-2 py-1 rounded border border-dark-400 w-full">
                             <option value="text">Text</option>
                             <option value="voice">Voice</option>
                             <option value="web">Web</option>
                           </select>
                         </label>
                         <label className="space-y-1">
                           <span className="block text-[10px] uppercase text-gray-500">Standard Passwort</span>
                           <input value={c.default_password || ''} onChange={(e) => setStructure((prev) => ({
                             ...prev,
                             uncategorized: prev.uncategorized.map((ch) => ch.id === c.id ? { ...ch, default_password: e.target.value } : ch),
                             categories: prev.categories,
                           }))} className="bg-dark-300 text-white px-2 py-1 rounded border border-dark-400 w-full" />
                         </label>
                         <label className="space-y-1">
                           <span className="block text-[10px] uppercase text-gray-500">Beitritt Passwort</span>
                           <input value={c.join_password || ''} onChange={(e) => setStructure((prev) => ({
                             ...prev,
                             uncategorized: prev.uncategorized.map((ch) => ch.id === c.id ? { ...ch, join_password: e.target.value } : ch),
                             categories: prev.categories,
                           }))} className="bg-dark-300 text-white px-2 py-1 rounded border border-dark-400 w-full" />
                         </label>
                       </div>
                       <div className="flex justify-end">
                         <button onClick={() => saveChannel(c)} className="bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"><Save size={14}/> Speichern</button>
                       </div>
                     </div>
                   ))}
                 </div>

                 <div className="space-y-4 overflow-y-auto max-h-[520px] pr-1 custom-scrollbar">
                   {structure.categories.map((cat) => (
                     <div key={cat.id} className="bg-dark-200 border border-dark-400 rounded p-3 space-y-2">
                       <div className="text-gray-400 text-xs uppercase font-bold">{cat.name}</div>
                       {cat.channels.map((c, idx) => (
                         <div key={c.id} className="bg-dark-300/60 border border-dark-400 rounded p-3 space-y-2">
                           <div className="flex items-center justify-between">
                             <input value={c.name} onChange={(e) => setStructure((prev) => ({
                               ...prev,
                               categories: prev.categories.map((cg) => cg.id === cat.id ? { ...cg, channels: cg.channels.map((ch) => ch.id === c.id ? { ...ch, name: e.target.value } : ch) } : cg),
                               uncategorized: prev.uncategorized,
                             }))} className="bg-dark-300 text-white px-2 py-1 rounded text-sm border border-dark-400" />
                             <div className="flex items-center gap-1">
                               <button onClick={() => moveChannel(cat.channels, idx, -1, cat.id)} className="p-1 text-gray-400 hover:text-white"><ArrowUp size={14}/></button>
                               <button onClick={() => moveChannel(cat.channels, idx, 1, cat.id)} className="p-1 text-gray-400 hover:text-white"><ArrowDown size={14}/></button>
                               <button onClick={() => setSelectedChannelForOverrides(c.id)} className="p-1 text-gray-400 hover:text-white" title="Overrides"><Settings2 size={14}/></button>
                             </div>
                           </div>
                           <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                             <label className="space-y-1">
                               <span className="block text-[10px] uppercase text-gray-500">Typ</span>
                               <select value={c.type} onChange={(e) => setStructure((prev) => ({
                                 ...prev,
                                 categories: prev.categories.map((cg) => cg.id === cat.id ? { ...cg, channels: cg.channels.map((ch) => ch.id === c.id ? { ...ch, type: e.target.value as any } : ch) } : cg),
                                 uncategorized: prev.uncategorized,
                               }))} className="bg-dark-300 text-white px-2 py-1 rounded border border-dark-400 w-full">
                                 <option value="text">Text</option>
                                 <option value="voice">Voice</option>
                                 <option value="web">Web</option>
                               </select>
                             </label>
                             <label className="space-y-1">
                               <span className="block text-[10px] uppercase text-gray-500">Standard Passwort</span>
                               <input value={c.default_password || ''} onChange={(e) => setStructure((prev) => ({
                                 ...prev,
                                 categories: prev.categories.map((cg) => cg.id === cat.id ? { ...cg, channels: cg.channels.map((ch) => ch.id === c.id ? { ...ch, default_password: e.target.value } : ch) } : cg),
                                 uncategorized: prev.uncategorized,
                               }))} className="bg-dark-300 text-white px-2 py-1 rounded border border-dark-400 w-full" />
                             </label>
                             <label className="space-y-1">
                               <span className="block text-[10px] uppercase text-gray-500">Beitritt Passwort</span>
                               <input value={c.join_password || ''} onChange={(e) => setStructure((prev) => ({
                                 ...prev,
                                 categories: prev.categories.map((cg) => cg.id === cat.id ? { ...cg, channels: cg.channels.map((ch) => ch.id === c.id ? { ...ch, join_password: e.target.value } : ch) } : cg),
                                 uncategorized: prev.uncategorized,
                               }))} className="bg-dark-300 text-white px-2 py-1 rounded border border-dark-400 w-full" />
                             </label>
                           </div>
                           <div className="flex justify-end">
                             <button onClick={() => saveChannel({ ...c, category_id: cat.id })} className="bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"><Save size={14}/> Speichern</button>
                           </div>
                         </div>
                       ))}
                     </div>
                   ))}
                 </div>
               </div>

               {selectedChannelForOverrides && (
                 <div className="mt-4 border-t border-dark-400 pt-4">
                   <div className="flex items-center gap-2 mb-2">
                     <Settings2 size={16} className="text-gray-400" />
                     <span className="text-gray-200 text-sm">Overrides für Kanal #{selectedChannelForOverrides}</span>
                   </div>
                   <div className="flex items-center gap-2 mb-2">
                     <select value={selectedOverrideRole || ''} onChange={(e) => {
                       const id = Number(e.target.value);
                       setSelectedOverrideRole(id);
                       const current = overridePermissions[id];
                       setOverrideDraft({ allow: current?.allow || {}, deny: current?.deny || {} });
                     }} className="bg-dark-300 text-white text-sm px-2 py-1 rounded border border-dark-400">
                       {roles.map((r) => (
                         <option key={r.id} value={r.id}>{r.name}</option>
                       ))}
                     </select>
                     <button onClick={saveOverride} className="bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"><Save size={14}/> Speichern</button>
                   </div>
                   <div className="grid grid-cols-3 gap-3">
                     {PERMISSIONS.map((p) => (
                       <div key={p.key} className="bg-dark-200 border border-dark-400 rounded p-3 text-sm text-white">
                         <div className="font-semibold mb-2">{p.label}</div>
                         <div className="flex items-center gap-2 text-xs">
                           <label className="flex items-center gap-1">
                             <input
                               type="checkbox"
                               checked={overrideDraft.allow[p.key] || false}
                               onChange={(e) => setOverrideDraft((prev) => ({ ...prev, allow: { ...prev.allow, [p.key]: e.target.checked } }))}
                             /> erlauben
                           </label>
                           <label className="flex items-center gap-1">
                             <input
                               type="checkbox"
                               checked={overrideDraft.deny[p.key] || false}
                               onChange={(e) => setOverrideDraft((prev) => ({ ...prev, deny: { ...prev.deny, [p.key]: e.target.checked } }))}
                             /> verbieten
                           </label>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
             </div>
           )}

           {activeTab === 'roles' && (
             <div className="h-full flex flex-col gap-4">
               <div className="flex items-center justify-between">
                 <h1 className="text-2xl font-bold text-white">Rollen & Berechtigungen</h1>
                 <button onClick={createRole} className="bg-primary px-3 py-1 rounded text-white flex items-center gap-2 text-sm"><Plus size={16}/> Neue Rolle</button>
               </div>
               <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-2 custom-scrollbar">
                 {roles.map((role) => (
                   <div key={role.id} className="bg-dark-200 border border-dark-400 rounded p-4 space-y-3">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <Shield size={16} className="text-yellow-500" />
                         <input
                           value={role.name}
                           onChange={(e) => setRoles((prev) => prev.map((r) => r.id === role.id ? { ...r, name: e.target.value } : r))}
                           onBlur={(e) => apiFetch(`/api/servers/${serverId}/roles/${role.id}`, { method: 'PUT', body: JSON.stringify({ name: e.target.value }) })}
                           className="bg-dark-300 text-white text-sm px-2 py-1 rounded border border-dark-400"
                         />
                       </div>
                       {!role.is_default && (
                         <button onClick={() => deleteRole(role.id)} className="text-red-400 hover:text-red-300 text-xs">Löschen</button>
                       )}
                     </div>
                     <div className="grid grid-cols-2 gap-2 text-xs text-white">
                       {PERMISSIONS.map((p) => (
                         <label key={p.key} className="flex items-center gap-2 bg-dark-300 rounded px-2 py-1 border border-dark-400">
                           <input type="checkbox" checked={role.permissions?.[p.key] || false} onChange={() => toggleRolePermission(role, p.key)} />
                           <span>{p.label}</span>
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
      {showCreateModal && <CreateChannelModal serverId={serverId!} defaultType={newChannelType} onClose={() => setShowCreateModal(false)} onCreated={loadStructure} />}
    </div>
  );
};
