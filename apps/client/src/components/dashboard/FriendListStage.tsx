import { useState, useEffect } from 'react';
import { ArrowLeft, MessageSquare, MoreVertical, Search, UserPlus, Check, X, Loader2, Ban } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { useSocket } from '../../context/SocketContext';

interface FriendListStageProps {
  onBackToHome?: () => void;
}

interface Friend {
  id: number;
  username: string;
  avatar_url?: string;
  status: 'online' | 'offline';
  activity?: string; // Optional, falls wir das später einbauen
}

interface PendingFriendRequest {
  id: number;
  direction: 'incoming' | 'outgoing';
  user: Friend;
}

interface BlockedFriendship {
  id: number;
  blockedByMe: boolean;
  user: Friend;
}

export const FriendListStage = ({ onBackToHome }: FriendListStageProps) => {
  const [activeTab, setActiveTab] = useState<'online' | 'all' | 'pending' | 'blocked'>('online');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingFriendRequest[]>([]);
  const [blockedRelations, setBlockedRelations] = useState<BlockedFriendship[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { socket } = useSocket();

  // Für das Hinzufügen
  const [addUsername, setAddUsername] = useState('');
  const [addStatus, setAddStatus] = useState('');

  // Daten laden
  const fetchFriends = async () => {
    setLoading(true);
    try {
      const [friendsRes, pendingRes, blockedRes] = await Promise.all([
        apiFetch<Friend[]>(`/api/friends`),
        apiFetch<PendingFriendRequest[]>(`/api/friends/pending`),
        apiFetch<BlockedFriendship[]>(`/api/friends/blocked`)
      ]);

      setFriends(friendsRes);
      setPendingRequests(pendingRes);
      setBlockedRelations(blockedRes);
    } catch (err) {
      console.error("Fehler beim Laden der Freunde", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  // Echtzeit-Statuswechsel via Socket
  useEffect(() => {
    if (!socket) return;
    const handleStatusChange = ({ userId, status }: { userId: number; status: 'online' | 'offline' }) => {
      setFriends(prev => prev.map(f => f.id === userId ? { ...f, status } : f));
      setPendingRequests(prev => prev.map(req => req.user?.id === userId ? { ...req, user: { ...req.user, status } } : req));
      setBlockedRelations(prev => prev.map(rel => rel.user?.id === userId ? { ...rel, user: { ...rel.user, status } } : rel));
    };

    socket.on('user_status_change', handleStatusChange);
    return () => {
      socket.off('user_status_change', handleStatusChange);
    };
  }, [socket]);

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

  const handleAccept = async (id: number) => {
    try {
      await apiFetch(`/api/friends/${id}/accept`, { method: 'POST' });
      await fetchFriends();
    } catch (err) {
      console.error('Fehler beim Annehmen', err);
    }
  };

  const handleDecline = async (id: number) => {
    try {
      await apiFetch(`/api/friends/${id}/decline`, { method: 'POST' });
      await fetchFriends();
    } catch (err) {
      console.error('Fehler beim Ablehnen', err);
    }
  };

  const handleBlock = async (id: number) => {
    try {
      await apiFetch(`/api/friends/${id}/block`, { method: 'POST' });
      await fetchFriends();
    } catch (err) {
      console.error('Fehler beim Blockieren', err);
    }
  };

  // Filter Logik
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (name: string) => !normalizedSearch || name.toLowerCase().includes(normalizedSearch);

  const filteredFriends = friends.filter(f => {
    if (!matchesSearch(f.username)) return false;
    if (activeTab === 'online') return f.status === 'online';
    if (activeTab === 'all') return true;
    return false;
  });

  const filteredPending = pendingRequests.filter(req => matchesSearch(req.user?.username ?? ''));
  const filteredBlocked = blockedRelations.filter(rel => matchesSearch(rel.user?.username ?? ''));

  const renderStatusBadge = (status: 'online' | 'offline') => (
    <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-[3px] border-dark-100 rounded-full ${status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
  );

  return (
    <div className="flex flex-col h-full bg-dark-100">

      {/* Top Bar */}
      <div className="h-12 border-b border-dark-400 flex items-center px-4 shadow-sm bg-dark-100 z-10 gap-2">
        {onBackToHome && (
          <button
            onClick={onBackToHome}
            className="flex items-center gap-1 text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-dark-300 transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="text-sm">Home</span>
          </button>
        )}

        <div className="flex items-center text-white font-bold mr-4 border-r border-gray-600 pr-4 gap-2">
           <span className="text-gray-400">Freunde</span>
        </div>

        <div className="flex items-center space-x-4 flex-1">
           <button onClick={() => setActiveTab('online')} className={`hover:bg-dark-300 px-2 py-1 rounded text-sm font-medium ${activeTab === 'online' ? 'text-white bg-dark-300' : 'text-gray-400'}`}>Online</button>
           <button onClick={() => setActiveTab('all')} className={`hover:bg-dark-300 px-2 py-1 rounded text-sm font-medium ${activeTab === 'all' ? 'text-white bg-dark-300' : 'text-gray-400'}`}>Alle</button>
           <button onClick={() => setActiveTab('pending')} className={`hover:bg-dark-300 px-2 py-1 rounded text-sm font-medium ${activeTab === 'pending' ? 'text-white bg-dark-300' : 'text-gray-400'}`}>Ausstehend</button>
           <button onClick={() => setActiveTab('blocked')} className={`hover:bg-dark-300 px-2 py-1 rounded text-sm font-medium ${activeTab === 'blocked' ? 'text-white bg-dark-300' : 'text-gray-400'}`}>Blockiert</button>

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
               <input
                 type="text"
                 placeholder="Suchen"
                 className="w-full bg-dark-400 text-white p-2 pl-2 rounded border border-transparent focus:border-blue-500 outline-none transition-colors"
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
               <Search className="absolute right-3 top-2.5 text-gray-500" size={18} />
            </div>

            <div className="text-xs font-bold text-gray-400 uppercase mb-4">
               {activeTab === 'online' && `Online — ${filteredFriends.length}`}
               {activeTab === 'all' && `Alle Freunde — ${filteredFriends.length}`}
               {activeTab === 'pending' && `Ausstehend — ${filteredPending.length}`}
               {activeTab === 'blocked' && `Blockiert — ${filteredBlocked.length}`}
            </div>

            <div className="space-y-2 border-t border-dark-400 pt-2">
               {loading && <div className="text-gray-500 flex items-center gap-2"><Loader2 className="animate-spin" size={16}/>Lade Freunde...</div>}

               {!loading && activeTab !== 'pending' && activeTab !== 'blocked' && filteredFriends.map(friend => (
                   <div key={friend.id} className="flex items-center justify-between group p-2.5 rounded hover:bg-dark-300/50 cursor-pointer border-t border-dark-400/30 first:border-none">
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-full bg-gray-500 relative flex items-center justify-center overflow-hidden">
                           {friend.avatar_url ? (
                             <img src={friend.avatar_url} className="w-full h-full object-cover" />
                           ) : (
                             <span className="text-white font-bold">{friend.username?.[0]?.toUpperCase() ?? ''}</span>
                           )}
                            {renderStatusBadge(friend.status)}
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

               {!loading && activeTab === 'pending' && filteredPending.map(request => (
                   <div key={request.id} className="flex items-center justify-between group p-2.5 rounded hover:bg-dark-300/50 cursor-pointer border-t border-dark-400/30 first:border-none">
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-full bg-gray-500 relative flex items-center justify-center overflow-hidden">
                            {request.user?.avatar_url ? <img src={request.user.avatar_url} className="w-full h-full object-cover" /> : <span className="text-white font-bold">{request.user?.username?.[0]?.toUpperCase()}</span>}
                            {request.user && renderStatusBadge(request.user.status)}
                         </div>
                         <div>
                            <div className="font-bold text-white flex items-center gap-1">
                               {request.user?.username}
                            </div>
                            <div className="text-xs text-gray-400">
                              {request.direction === 'incoming' ? 'Anfrage erhalten' : 'Anfrage gesendet'} · {request.user?.status === 'online' ? 'Online' : 'Offline'}
                            </div>
                         </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 bg-dark-400 p-1 rounded transition-opacity">
                         {request.direction === 'incoming' && (
                           <>
                             <button onClick={() => handleAccept(request.id)} className="p-2 bg-green-700 rounded-full hover:text-white text-gray-200" title="Annehmen"><Check size={18} /></button>
                             <button onClick={() => handleDecline(request.id)} className="p-2 bg-dark-300 rounded-full hover:text-white text-gray-400" title="Ablehnen"><X size={18} /></button>
                           </>
                         )}
                         <button onClick={() => handleBlock(request.id)} className="p-2 bg-red-900/70 rounded-full hover:text-white text-gray-200" title="Blockieren"><Ban size={18} /></button>
                      </div>
                   </div>
               ))}

               {!loading && activeTab === 'blocked' && filteredBlocked.map(entry => (
                   <div key={entry.id} className="flex items-center justify-between group p-2.5 rounded hover:bg-dark-300/50 cursor-pointer border-t border-dark-400/30 first:border-none">
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-full bg-gray-500 relative flex items-center justify-center overflow-hidden">
                            {entry.user?.avatar_url ? <img src={entry.user.avatar_url} className="w-full h-full object-cover" /> : <span className="text-white font-bold">{entry.user?.username?.[0]?.toUpperCase()}</span>}
                            {entry.user && renderStatusBadge(entry.user.status)}
                         </div>
                         <div>
                            <div className="font-bold text-white flex items-center gap-1">
                               {entry.user?.username}
                            </div>
                            <div className="text-xs text-gray-400">{entry.blockedByMe ? 'Du hast blockiert' : 'Dich blockiert'} · {entry.user?.status === 'online' ? 'Online' : 'Offline'}</div>
                         </div>
                      </div>
                   </div>
               ))}

               {!loading && activeTab === 'pending' && filteredPending.length === 0 && (
                 <div className="text-gray-500">Keine ausstehenden Anfragen.</div>
               )}

               {!loading && activeTab === 'blocked' && filteredBlocked.length === 0 && (
                 <div className="text-gray-500">Keine blockierten Nutzer.</div>
               )}

               {!loading && activeTab !== 'pending' && activeTab !== 'blocked' && filteredFriends.length === 0 && (
                 <div className="text-gray-500">Keine Freunde gefunden.</div>
               )}
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
