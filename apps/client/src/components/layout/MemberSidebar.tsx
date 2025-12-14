import { useState, useEffect } from 'react';
import { User, Shield, Crown } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { useSocket } from '../../context/SocketContext';

interface Member {
  userId: number;
  role: 'owner' | 'admin' | 'member';
  User: {
    username: string;
    avatar_url?: string;
    status: 'online' | 'offline';
  };
}

export const MemberSidebar = ({ serverId }: { serverId: number }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const { socket } = useSocket();

  // --- API LOGIC: Mitglieder Laden ---
  useEffect(() => {
    let isActive = true;
    const fetchMembers = async () => {
      setLoading(true);
      try {
        const res = await apiFetch<Member[]>(`/api/servers/${serverId}/members`);
        if (isActive) setMembers(res);
      } catch (err) {
        console.error("Fehler beim Laden der Member:", err);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    if (serverId) {
      fetchMembers();
      const intervalId = setInterval(fetchMembers, 60_000);

      return () => {
        isActive = false;
        clearInterval(intervalId);
      };
    }

    return () => {
      isActive = false;
    };
  }, [serverId]);

  useEffect(() => {
    if (!socket) return;

    const handleStatusChange = ({ userId, status }: { userId: number; status: 'online' | 'offline' }) => {
      setMembers(prev => prev.map((member) => member.userId === userId ? { ...member, User: { ...member.User, status } } : member));
    };

    socket.on('user_status_change', handleStatusChange);

    return () => {
      socket.off('user_status_change', handleStatusChange);
    };
  }, [socket]);

  // Gruppenlogik (Online / Offline)
  const onlineMembers = members.filter(m => m.User?.status === 'online');
  const offlineMembers = members.filter(m => m.User?.status !== 'online');

  const renderMember = (m: Member) => (
      <div key={m.userId} className="flex items-center p-2 mb-1 rounded-lg hover:bg-white/5 cursor-pointer group transition-all">
          <div className="w-9 h-9 rounded-full bg-glass-300 mr-3 relative flex items-center justify-center flex-shrink-0">
              {m.User?.avatar_url ? (
                  <img src={m.User.avatar_url} className="w-full h-full rounded-full object-cover" />
              ) : (
                  <span className="font-bold text-gray-400 text-xs">{m.User?.username?.[0]?.toUpperCase()}</span>
              )}
              
              {/* Status Dot */}
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#111214] 
                  ${m.User?.status === 'online' ? 'bg-success' : 'bg-gray-500'}`}>
              </div>
          </div>
          
          <div className="overflow-hidden">
              <div className="text-sm font-medium text-gray-300 group-hover:text-white truncate flex items-center gap-1">
                  {m.User?.username}
                  {m.role === 'owner' && <Crown size={12} className="text-yellow-500 fill-yellow-500/20" />}
                  {m.role === 'admin' && <Shield size={12} className="text-primary fill-primary/20" />}
              </div>
              {/* Custom Status Text (Dummy für jetzt) */}
              <div className="text-[10px] text-gray-500 truncate group-hover:text-gray-400">
                  {m.User?.status === 'online' ? 'Bereit zum Zocken' : 'Offline'}
              </div>
          </div>
      </div>
  );

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b border-white/5 flex-shrink-0">
        <span className="text-xs font-black tracking-widest text-gray-500 uppercase">Personal</span>
        <span className="ml-auto text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">{members.length}</span>
      </div>

      <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-6">
          {/* Online Group */}
          <div>
              <div className="text-[10px] font-bold text-gray-500 mb-2 px-2 uppercase tracking-wider flex items-center gap-2">
                 Online <span className="text-[9px] text-gray-600">— {onlineMembers.length}</span>
              </div>
              {onlineMembers.map(renderMember)}
          </div>

           {/* Offline Group */}
           <div>
              <div className="text-[10px] font-bold text-gray-500 mb-2 px-2 uppercase tracking-wider flex items-center gap-2">
                 Offline <span className="text-[9px] text-gray-600">— {offlineMembers.length}</span>
              </div>
              {offlineMembers.map(renderMember)}
          </div>
      </div>
    </div>
  );
};