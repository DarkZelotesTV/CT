import { useState, useEffect } from 'react';
import { X, Trash2, Shield, Save, Loader2 } from 'lucide-react';
import { apiFetch } from '../../api/http';

interface ServerSettingsProps {
  serverId: number;
  onClose: () => void;
}

export const ServerSettingsModal = ({ serverId, onClose }: ServerSettingsProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [members, setMembers] = useState<any[]>([]);
  const [serverName, setServerName] = useState('');
  const [loading, setLoading] = useState(false);

  // Server Details laden (für den Namen)
  useEffect(() => {
    const loadDetails = async () => {
        try {
            const res = await apiFetch<any[]>(`/api/servers`);
            const myServer = res.find((s: any) => s.id === serverId);
            if (myServer) setServerName(myServer.name);
        } catch(e) {}
    };
    loadDetails();
  }, [serverId]);

  // Mitglieder laden
  useEffect(() => {
    if (activeTab === 'members') {
      const load = async () => {
         setLoading(true);
         try {
            const res = await apiFetch<any[]>(`/api/servers/${serverId}/members`);
            setMembers(res);
         } catch(e) { console.error(e); }
         setLoading(false);
      };
      load();
    }
  }, [activeTab, serverId]);

  // Server Update (Name)
  const handleSave = async () => {
    try {
        await apiFetch(`/api/servers/${serverId}`,
            { method: 'PUT', body: JSON.stringify({ name: serverName }) }
        );
        alert("Server gespeichert!");
        window.location.reload(); // Einfachste Methode um UI zu refreshen
    } catch(e) { alert("Fehler beim Speichern"); }
  };

  // User Kicken
  const handleKick = async (userId: number) => {
    if(!confirm("Diesen Nutzer wirklich kicken?")) return;
    try {
        await apiFetch(`/api/servers/${serverId}/members/${userId}`, { method: 'DELETE' });
        setMembers(prev => prev.filter(m => m.user_id !== userId)); // UI Update
    } catch(e) { alert("Konnte User nicht kicken (Fehlende Rechte?)"); }
  };

  // Server Löschen
  const handleDeleteServer = async () => {
      const name = prompt("Tippe den Servernamen zum Löschen:");
      if (name !== serverName) return alert("Name stimmt nicht überein.");
      
      try {
        await apiFetch(`/api/servers/${serverId}`, { method: 'DELETE' });
        window.location.reload();
      } catch(e) { alert("Fehler beim Löschen."); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center animate-in fade-in">
      <div className="bg-dark-100 w-[800px] h-[600px] rounded-lg shadow-2xl flex overflow-hidden border border-dark-400">
        
        {/* Sidebar */}
        <div className="w-60 bg-dark-200 p-4 flex flex-col">
           <h2 className="font-bold text-gray-400 uppercase text-xs mb-4 px-2">Einstellungen</h2>
           <div onClick={() => setActiveTab('overview')} className={`px-2 py-1.5 rounded cursor-pointer mb-1 ${activeTab === 'overview' ? 'bg-dark-300 text-white' : 'text-gray-400 hover:bg-dark-300'}`}>Übersicht</div>
           <div onClick={() => setActiveTab('members')} className={`px-2 py-1.5 rounded cursor-pointer mb-1 ${activeTab === 'members' ? 'bg-dark-300 text-white' : 'text-gray-400 hover:bg-dark-300'}`}>Mitglieder</div>
           
           <div className="mt-auto pt-4 border-t border-dark-400">
              <div onClick={handleDeleteServer} className="text-red-400 px-2 py-1.5 rounded cursor-pointer hover:bg-red-500/10 flex items-center gap-2">
                 <Trash2 size={16} /> Server löschen
              </div>
           </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-dark-100 p-10 relative">
           <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white flex flex-col items-center">
              <div className="border-2 border-gray-400 rounded-full p-1 mb-1"><X size={16}/></div>
              <span className="text-[10px] uppercase font-bold">Esc</span>
           </button>

           {activeTab === 'overview' && (
             <div className="space-y-6">
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
                <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium flex items-center gap-2">
                    <Save size={18} /> Speichern
                </button>
             </div>
           )}

           {activeTab === 'members' && (
             <div className="h-full flex flex-col">
                <h1 className="text-2xl font-bold text-white mb-6">Mitglieder ({members.length})</h1>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                   {loading ? <Loader2 className="animate-spin text-white mx-auto"/> : members.map((m: any) => (
                      <div key={m.user_id || m.id} className="flex items-center justify-between py-3 border-b border-dark-400">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white font-bold">
                               {m.User?.username?.[0] || '?'}
                            </div>
                            <span className="font-bold text-white">{m.User?.username || 'Unbekannt'}</span>
                            {m.role === 'admin' && <Shield size={14} className="text-yellow-500"/>}
                         </div>
                         {m.role !== 'admin' && (
                             <button onClick={() => handleKick(m.user_id)} className="text-xs bg-dark-300 hover:text-red-400 px-3 py-1 rounded transition-colors">Kicken</button>
                         )}
                      </div>
                   ))}
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};