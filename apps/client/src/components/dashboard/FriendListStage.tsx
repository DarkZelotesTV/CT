import { useState, useEffect } from 'react';
import { MessageSquare, MoreVertical, Search, UserPlus, Check, X, Loader2 } from 'lucide-react';
import { apiFetch } from '../../api/http';

interface Friend {
  id: number;
  username: string;
  avatar_url?: string;
  status: 'online' | 'offline';
  activity?: string; // Optional, falls wir das später einbauen
}

export const FriendListStage = () => {
  const [activeTab, setActiveTab] = useState<'online' | 'all' | 'pending' | 'blocked'>('online');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Für das Hinzufügen
  const [addUsername, setAddUsername] = useState('');
  const [addStatus, setAddStatus] = useState('');

  // Daten laden
  const fetchFriends = async () => {
    setLoading(true);
    try {
      // 1. Hole akzeptierte Freunde
      const res = await apiFetch<Friend[]>(`/api/friends`);
      setFriends(res);
      
      // TODO: Einen separaten Endpunkt für 'pending' Requests im Backend bauen
      // Aktuell simulieren wir das, da der Endpoint im Backend-Beispiel nur 'accepted' lieferte.
    } catch (err) {
      console.error("Fehler beim Laden der Freunde", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, [activeTab]);

  // Freund hinzufügen
  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUsername) return;
    setAddStatus('Sende...');
    
    try {
      await apiFetch(`/api/friends/request`,
        { method: 'POST', body: JSON.stringify({ username: addUsername }) }
      );
      setAddStatus('Anfrage gesendet! ✅');
      setAddUsername('');
    } catch (err: any) {
      setAddStatus(err.response?.data?.error || 'Fehler beim Senden ❌');
    }
  };

  // Filter Logik
  const filteredFriends = friends.filter(f => {
    if (activeTab === 'online') return f.status === 'online';
    if (activeTab === 'all') return true;
    return false;
  });

  return (
    <div className="flex flex-col h-full bg-dark-100">
      
      {/* Top Bar */}
      <div className="h-12 border-b border-dark-400 flex items-center px-4 shadow-sm bg-dark-100 z-10">
        <div className="flex items-center text-white font-bold mr-4 border-r border-gray-600 pr-4 gap-2">
           <span className="text-gray-400">Freunde</span>
        </div>
        
        <div className="flex items-center space-x-4 flex-1">
           <button onClick={() => setActiveTab('online')} className={`hover:bg-dark-300 px-2 py-1 rounded text-sm font-medium ${activeTab === 'online' ? 'text-white bg-dark-300' : 'text-gray-400'}`}>Online</button>
           <button onClick={() => setActiveTab('all')} className={`hover:bg-dark-300 px-2 py-1 rounded text-sm font-medium ${activeTab === 'all' ? 'text-white bg-dark-300' : 'text-gray-400'}`}>Alle</button>
           <button onClick={() => setActiveTab('pending')} className={`hover:bg-dark-300 px-2 py-1 rounded text-sm font-medium ${activeTab === 'pending' ? 'text-white bg-dark-300' : 'text-gray-400'}`}>Ausstehend</button>
           
           <div className="ml-auto relative group">
             <button className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-sm font-medium flex items-center gap-1 transition-colors">
               <UserPlus size={16} /> Freund hinzufügen
             </button>
             {/* Kleines Popover zum Adden */}
             <div className="absolute right-0 top-full mt-2 w-64 bg-dark-200 border border-dark-400 p-3 rounded-lg shadow-xl invisible group-focus-within:visible opacity-0 group-focus-within:opacity-100 transition-all z-50">
                <form onSubmit={handleAddFriend}>
                  <input 
                    className="w-full bg-black/30 border border-dark-400 rounded p-2 text-white text-sm outline-none focus:border-green-500" 
                    placeholder="Nutzername eingeben..."
                    value={addUsername}
                    onChange={e => setAddUsername(e.target.value)}
                  />
                  <div className="text-[10px] mt-1 text-gray-400 text-right">{addStatus}</div>
                </form>
             </div>
           </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex">
         <div className="flex-1 p-6 overflow-y-auto">
            {/* Suche */}
            <div className="mb-6 relative">
               <input type="text" placeholder="Suchen" className="w-full bg-dark-400 text-white p-2 pl-2 rounded border border-transparent focus:border-blue-500 outline-none transition-colors" />
               <Search className="absolute right-3 top-2.5 text-gray-500" size={18} />
            </div>

            <div className="text-xs font-bold text-gray-400 uppercase mb-4">
               {activeTab === 'online' ? `Online — ${filteredFriends.length}` : 'Alle Freunde'}
            </div>

            <div className="space-y-2 border-t border-dark-400 pt-2">
               {loading && <div className="text-gray-500 flex items-center gap-2"><Loader2 className="animate-spin" size={16}/> Lade Freunde...</div>}
               
               {!loading && filteredFriends.map(friend => (
                   <div key={friend.id} className="flex items-center justify-between group p-2.5 rounded hover:bg-dark-300/50 cursor-pointer border-t border-dark-400/30 first:border-none">
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-full bg-gray-500 relative flex items-center justify-center overflow-hidden">
                            {friend.avatar_url ? <img src={friend.avatar_url} className="w-full h-full object-cover" /> : <span className="text-white font-bold">{friend.username[0].toUpperCase()}</span>}
                            <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-[3px] border-dark-100 rounded-full ${friend.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                         </div>
                         <div>
                            <div className="font-bold text-white flex items-center gap-1">
                               {friend.username} 
                            </div>
                            <div className="text-xs text-gray-400">{friend.status === 'online' ? 'Online' : 'Offline'}</div>
                         </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 bg-dark-400 p-1 rounded transition-opacity">
                         <button className="p-2 bg-dark-300 rounded-full hover:text-white text-gray-400" title="Nachricht"><MessageSquare size={18} /></button>
                         <button className="p-2 bg-dark-300 rounded-full hover:text-white text-gray-400" title="Mehr"><MoreVertical size={18} /></button>
                      </div>
                   </div>
               ))}
            </div>
         </div>
         {/* Rechte Seite: "Jetzt aktiv" */}
         <div className="w-80 border-l border-dark-400 p-4 hidden xl:block">
            <h3 className="text-xl font-bold text-white mb-4">Jetzt aktiv</h3>
            <div className="text-center mt-10 text-gray-400">
               <div className="font-bold">Momentan ist alles ruhig.</div>
            </div>
         </div>
      </div>
    </div>
  );
};