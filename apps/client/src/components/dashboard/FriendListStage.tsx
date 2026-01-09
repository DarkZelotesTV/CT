import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MessageSquare, MoreVertical, Search, UserPlus, Check, X, Loader2, Ban } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { useSocket } from '../../context/SocketContext';
import { resolveServerAssetUrl } from '../../utils/assetUrl';
import { Button, Input, Popover, PopoverContent, PopoverTrigger, StatusBadge } from '../ui';
import { IconButton } from '../ui/Button';

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
  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false);
  const addInputRef = useRef<HTMLInputElement | null>(null);

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
    <StatusBadge
      variant="dot"
      size="md"
      status={status}
      className="absolute -right-0.5 -bottom-0.5"
    />
  );

  return (
    <div className="flex flex-col h-full bg-surface">

      {/* Top Bar */}
      <div className="h-12 border-b border-border flex items-center px-4 shadow-sm bg-surface z-10 gap-2">
        {onBackToHome && (
          <Button
            onClick={onBackToHome}
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 text-[color:var(--color-text-muted)] hover:text-text px-2 py-1 rounded hover:bg-surface-3 transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="text-sm">Home</span>
          </Button>
        )}

        <div className="flex items-center text-text font-bold mr-4 border-r border-border pr-4 gap-2">
           <span className="text-[color:var(--color-text-muted)]">Freunde</span>
        </div>

        <div className="flex items-center space-x-4 flex-1">
           <Button onClick={() => setActiveTab('online')} variant="ghost" size="sm" className={`px-2 py-1 text-sm font-medium ${activeTab === 'online' ? 'text-text bg-surface-3' : 'text-[color:var(--color-text-muted)]'} hover:bg-surface-3`}>Online</Button>
           <Button onClick={() => setActiveTab('all')} variant="ghost" size="sm" className={`px-2 py-1 text-sm font-medium ${activeTab === 'all' ? 'text-text bg-surface-3' : 'text-[color:var(--color-text-muted)]'} hover:bg-surface-3`}>Alle</Button>
           <Button onClick={() => setActiveTab('pending')} variant="ghost" size="sm" className={`px-2 py-1 text-sm font-medium ${activeTab === 'pending' ? 'text-text bg-surface-3' : 'text-[color:var(--color-text-muted)]'} hover:bg-surface-3`}>Ausstehend</Button>
           <Button onClick={() => setActiveTab('blocked')} variant="ghost" size="sm" className={`px-2 py-1 text-sm font-medium ${activeTab === 'blocked' ? 'text-text bg-surface-3' : 'text-[color:var(--color-text-muted)]'} hover:bg-surface-3`}>Blockiert</Button>

           <div className="ml-auto relative">
             <Popover open={isAddPopoverOpen} onOpenChange={setIsAddPopoverOpen}>
               <PopoverTrigger>
                 <Button variant="success" size="sm">
                   <UserPlus size={16} /> Freund hinzufügen
                 </Button>
               </PopoverTrigger>
               <PopoverContent
                 className="absolute right-0 top-full mt-2 w-64 bg-surface-2 border border-border p-3 rounded-lg shadow-xl z-50"
                 initialFocusRef={addInputRef}
               >
                 <form onSubmit={handleAddFriend}>
                   <Input
                     ref={addInputRef}
                     className="bg-surface/60 text-text text-sm"
                     placeholder="Nutzername eingeben..."
                     value={addUsername}
                     onChange={e => setAddUsername(e.target.value)}
                   />
                   <div className="text-[10px] mt-1 text-[color:var(--color-text-muted)] text-right">{addStatus}</div>
                 </form>
               </PopoverContent>
             </Popover>
           </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex">
         <div className="flex-1 p-6 overflow-y-auto">
            {/* Suche */}
            <div className="mb-6 relative">
               <Input
                 type="text"
                 placeholder="Suchen"
                 className="bg-surface-3 text-text p-2 pl-2 rounded border border-transparent"
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
               />
               <Search className="absolute right-3 top-2.5 text-[color:var(--color-text-muted)]" size={18} />
            </div>

            <div className="text-xs font-bold text-[color:var(--color-text-muted)] uppercase mb-4">
               {activeTab === 'online' && `Online — ${filteredFriends.length}`}
               {activeTab === 'all' && `Alle Freunde — ${filteredFriends.length}`}
               {activeTab === 'pending' && `Ausstehend — ${filteredPending.length}`}
               {activeTab === 'blocked' && `Blockiert — ${filteredBlocked.length}`}
            </div>

            <div className="space-y-2 border-t border-border pt-2">
               {loading && <div className="text-[color:var(--color-text-muted)] flex items-center gap-2"><Loader2 className="animate-spin" size={16}/>Lade Freunde...</div>}

               {!loading && activeTab !== 'pending' && activeTab !== 'blocked' && filteredFriends.map(friend => (
                   <div key={friend.id} className="flex items-center justify-between group p-2.5 rounded hover:bg-surface-3/50 cursor-pointer border-t border-border/30 first:border-none">
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-full bg-[color:var(--color-surface-hover)] relative flex items-center justify-center overflow-hidden">
                           {friend.avatar_url ? (
                             <img src={resolveServerAssetUrl(friend.avatar_url)} className="w-full h-full object-cover" />
                           ) : (
                             <span className="text-text font-bold">{friend.username?.[0]?.toUpperCase() ?? ''}</span>
                           )}
                            {renderStatusBadge(friend.status)}
                         </div>
                         <div>
                            <div className="font-bold text-text flex items-center gap-1">
                               {friend.username}
                            </div>
                            <div className="text-xs text-[color:var(--color-text-muted)]">{friend.status === 'online' ? 'Online' : 'Offline'}</div>
                         </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 bg-surface-3 p-1 rounded transition-opacity">
                         <IconButton
                           aria-label="Nachricht"
                           size="sm"
                           variant="ghost"
                           className="p-2 bg-surface-2 rounded-full hover:text-text text-[color:var(--color-text-muted)]"
                           title="Nachricht"
                         >
                           <MessageSquare size={18} />
                         </IconButton>
                         <IconButton
                           aria-label="Mehr"
                           size="sm"
                           variant="ghost"
                           className="p-2 bg-surface-2 rounded-full hover:text-text text-[color:var(--color-text-muted)]"
                           title="Mehr"
                         >
                           <MoreVertical size={18} />
                         </IconButton>
                      </div>
                   </div>
               ))}

               {!loading && activeTab === 'pending' && filteredPending.map(request => (
                   <div key={request.id} className="flex items-center justify-between group p-2.5 rounded hover:bg-surface-3/50 cursor-pointer border-t border-border/30 first:border-none">
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-full bg-[color:var(--color-surface-hover)] relative flex items-center justify-center overflow-hidden">
                            {request.user?.avatar_url ? <img src={resolveServerAssetUrl(request.user.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-text font-bold">{request.user?.username?.[0]?.toUpperCase()}</span>}
                            {request.user && renderStatusBadge(request.user.status)}
                         </div>
                         <div>
                            <div className="font-bold text-text flex items-center gap-1">
                               {request.user?.username}
                            </div>
                            <div className="text-xs text-[color:var(--color-text-muted)]">
                              {request.direction === 'incoming' ? 'Anfrage erhalten' : 'Anfrage gesendet'} · {request.user?.status === 'online' ? 'Online' : 'Offline'}
                            </div>
                         </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 bg-surface-3 p-1 rounded transition-opacity">
                         {request.direction === 'incoming' && (
                           <>
                             <IconButton
                               onClick={() => handleAccept(request.id)}
                               aria-label="Annehmen"
                               size="sm"
                               className="p-2 bg-[color:var(--color-text-success)] rounded-full hover:text-[color:var(--color-on-accent)] text-[color:var(--color-text)]"
                               title="Annehmen"
                             >
                               <Check size={18} />
                             </IconButton>
                             <IconButton
                               onClick={() => handleDecline(request.id)}
                               aria-label="Ablehnen"
                               size="sm"
                               variant="ghost"
                               className="p-2 bg-surface-2 rounded-full hover:text-text text-[color:var(--color-text-muted)]"
                               title="Ablehnen"
                             >
                               <X size={18} />
                             </IconButton>
                           </>
                         )}
                         <IconButton
                           onClick={() => handleBlock(request.id)}
                           aria-label="Blockieren"
                           size="sm"
                           className="p-2 bg-[color:var(--color-text-danger)] rounded-full hover:text-[color:var(--color-on-accent)] text-[color:var(--color-text)]"
                           title="Blockieren"
                         >
                           <Ban size={18} />
                         </IconButton>
                      </div>
                   </div>
               ))}

               {!loading && activeTab === 'blocked' && filteredBlocked.map(entry => (
                   <div key={entry.id} className="flex items-center justify-between group p-2.5 rounded hover:bg-surface-3/50 cursor-pointer border-t border-border/30 first:border-none">
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-full bg-[color:var(--color-surface-hover)] relative flex items-center justify-center overflow-hidden">
                            {entry.user?.avatar_url ? <img src={resolveServerAssetUrl(entry.user.avatar_url)} className="w-full h-full object-cover" /> : <span className="text-text font-bold">{entry.user?.username?.[0]?.toUpperCase()}</span>}
                            {entry.user && renderStatusBadge(entry.user.status)}
                         </div>
                         <div>
                            <div className="font-bold text-text flex items-center gap-1">
                               {entry.user?.username}
                            </div>
                            <div className="text-xs text-[color:var(--color-text-muted)]">{entry.blockedByMe ? 'Du hast blockiert' : 'Dich blockiert'} · {entry.user?.status === 'online' ? 'Online' : 'Offline'}</div>
                         </div>
                      </div>
                   </div>
               ))}

               {!loading && activeTab === 'pending' && filteredPending.length === 0 && (
                 <div className="text-[color:var(--color-text-muted)]">Keine ausstehenden Anfragen.</div>
               )}

               {!loading && activeTab === 'blocked' && filteredBlocked.length === 0 && (
                 <div className="text-[color:var(--color-text-muted)]">Keine blockierten Nutzer.</div>
               )}

               {!loading && activeTab !== 'pending' && activeTab !== 'blocked' && filteredFriends.length === 0 && (
                 <div className="text-[color:var(--color-text-muted)]">Keine Freunde gefunden.</div>
               )}
            </div>
         </div>
         {/* Rechte Seite: "Jetzt aktiv" */}
         <div className="w-80 border-l border-border p-4 hidden xl:block">
            <h3 className="text-xl font-bold text-text mb-4">Jetzt aktiv</h3>
            <div className="text-center mt-10 text-[color:var(--color-text-muted)]">
               <div className="font-bold">Momentan ist alles ruhig.</div>
            </div>
         </div>
      </div>
    </div>
  );
};
