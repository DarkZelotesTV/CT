import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Trash2, Shield, Users } from 'lucide-react';
import { getServerUrl } from '../../utils/apiConfig';

interface ServerSettingsProps {
  serverId: number;
  onClose: () => void;
}

export const ServerSettingsModal = ({ serverId, onClose }: ServerSettingsProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [members, setMembers] = useState<any[]>([]);

  // Mitglieder laden für Verwaltungs-Tab
  useEffect(() => {
    if (activeTab === 'members') {
      // Nutze bestehenden Endpunkt oder erstelle einen neuen Admin-Endpunkt mit mehr Details
      const load = async () => {
         const token = localStorage.getItem('clover_token');
         const res = await axios.get(`${getServerUrl()}/api/servers/${serverId}/members`, {
             headers: { Authorization: `Bearer ${token}` }
         });
         setMembers(res.data);
      };
      load();
    }
  }, [activeTab, serverId]);

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center animate-in fade-in">
      <div className="bg-dark-100 w-[800px] h-[600px] rounded-lg shadow-2xl flex overflow-hidden border border-dark-400">
        
        {/* Sidebar */}
        <div className="w-60 bg-dark-200 p-4 flex flex-col">
           <h2 className="font-bold text-gray-400 uppercase text-xs mb-4 px-2">Server Einstellungen</h2>
           
           <div 
             onClick={() => setActiveTab('overview')}
             className={`px-2 py-1.5 rounded cursor-pointer mb-1 ${activeTab === 'overview' ? 'bg-dark-300 text-white' : 'text-gray-400 hover:bg-dark-300'}`}
           >
             Übersicht
           </div>
           <div 
             onClick={() => setActiveTab('members')}
             className={`px-2 py-1.5 rounded cursor-pointer mb-1 ${activeTab === 'members' ? 'bg-dark-300 text-white' : 'text-gray-400 hover:bg-dark-300'}`}
           >
             Mitglieder
           </div>
           
           <div className="mt-auto pt-4 border-t border-dark-400">
              <div className="text-red-400 px-2 py-1.5 rounded cursor-pointer hover:bg-red-500/10 flex items-center gap-2">
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
             <div>
                <h1 className="text-2xl font-bold text-white mb-6">Server Übersicht</h1>
                <div className="flex gap-8">
                   <div className="w-24 h-24 bg-dark-300 rounded-full flex items-center justify-center text-xs text-gray-400 border-dashed border-2 border-dark-400 cursor-pointer hover:border-white">
                      Bild ändern
                   </div>
                   <div className="flex-1 space-y-4">
                      <div>
                         <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Servername</label>
                         <input type="text" className="w-full bg-dark-300 p-2 rounded text-white outline-none" defaultValue="Mein Server" />
                      </div>
                   </div>
                </div>
             </div>
           )}

           {activeTab === 'members' && (
             <div className="h-full flex flex-col">
                <h1 className="text-2xl font-bold text-white mb-6">Mitgliederverwaltung</h1>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                   {members.map(m => (
                      <div key={m.userId} className="flex items-center justify-between py-3 border-b border-dark-400">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-500">
                               {m.avatarUrl && <img src={m.avatarUrl} className="rounded-full" />}
                            </div>
                            <span className="font-bold text-white">{m.username}</span>
                         </div>
                         <div className="flex gap-2">
                            {/* Ban / Kick Buttons hier einfügen */}
                            <button className="text-xs bg-dark-300 hover:text-red-400 px-3 py-1 rounded">Kicken</button>
                         </div>
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