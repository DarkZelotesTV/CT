import { useState, useEffect } from 'react';
import { Shield, Crown } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { useSocket } from '../../context/SocketContext';

interface Member {
  userId: number;
  username: string;
  avatarUrl?: string;
  status: 'online' | 'offline';
  roles?: any[];
}

export const MemberSidebar = ({ serverId }: { serverId: number }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const { socket, presenceSnapshot } = useSocket();

  const normalizeMember = (m: any): Member => ({
    userId: m.userId ?? m.user_id ?? m.User?.id ?? m.user?.id,
    username: m.username ?? m.User?.username ?? m.user?.username ?? 'Unbekannt',
    avatarUrl: m.avatarUrl ?? m.avatar_url ?? m.User?.avatar_url ?? m.user?.avatar_url,
    status: m.status ?? m.User?.status ?? m.user?.status ?? 'offline',
    roles: m.roles ?? (m.role ? [m.role] : []),
  });

  // --- API LOGIC: Mitglieder Laden ---
  useEffect(() => {
    if (!serverId) return;

    let isActive = true;
    const fetchMembers = async () => {
      setLoading(true);
      try {
        const res = await apiFetch<any[]>(`/api/servers/${serverId}/members`);
        if (isActive) setMembers(res.map(normalizeMember));
      } catch (err) {
        console.error("Fehler beim Laden der Member:", err);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    if (socket) {
      socket.emit('request_server_members', { serverId });
      const fallbackTimer = setTimeout(() => {
        if (isActive) fetchMembers();
      }, 5_000);

      return () => {
        isActive = false;
        clearTimeout(fallbackTimer);
      };
    }

    fetchMembers();

    return () => {
      isActive = false;
    };
  }, [serverId, socket]);

  useEffect(() => {
    if (!socket) return;

    const handleStatusChange = ({ userId, status }: { userId: number; status: 'online' | 'offline' }) => {
      setMembers(prev => prev.map((member) => member.userId === userId ? { ...member, status } : member));
    };

    const handleMemberSnapshot = ({ serverId: incomingServerId, members: incomingMembers }: { serverId: number; members: any[] }) => {
      if (incomingServerId !== serverId) return;
      setMembers(incomingMembers.map(normalizeMember));
      setLoading(false);
    };

    socket.on('user_status_change', handleStatusChange);
    socket.on('server_members_snapshot', handleMemberSnapshot);

    return () => {
      socket.off('user_status_change', handleStatusChange);
      socket.off('server_members_snapshot', handleMemberSnapshot);
    };
  }, [socket, serverId]);

  useEffect(() => {
    setMembers((prev) => prev.map((member) => {
      const snapshot = presenceSnapshot[member.userId];
      if (!snapshot) return member;
      return {
        ...member,
        username: snapshot.username ?? member.username,
        avatarUrl: snapshot.avatar_url ?? member.avatarUrl,
        status: snapshot.status ?? member.status,
      };
    }));
  }, [presenceSnapshot]);

  // Gruppenlogik (Online / Offline)
  const onlineMembers = members.filter(m => m.status === 'online');
  const offlineMembers = members.filter(m => m.status !== 'online');

  const renderMember = (m: Member) => (
      <div key={m.userId} className="flex items-center p-2 mb-1 rounded-lg hover:bg-white/5 cursor-pointer group transition-all">
          <div className="w-9 h-9 rounded-full bg-glass-300 mr-3 relative flex items-center justify-center flex-shrink-0">
              {m.avatarUrl ? (
                  <img src={m.avatarUrl} className="w-full h-full rounded-full object-cover" />
              ) : (
                  <span className="font-bold text-gray-400 text-xs">{m.username?.[0]?.toUpperCase()}</span>
              )}

              {/* Status Dot */}
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#111214]
                  ${m.status === 'online' ? 'bg-success' : 'bg-gray-500'}`}>
              </div>
          </div>

          <div className="overflow-hidden">
              <div className="text-sm font-medium text-gray-300 group-hover:text-white truncate flex items-center gap-1">
                  {m.username}
                  {m.roles?.some((r: any) => r.name === 'owner') && <Crown size={12} className="text-yellow-500 fill-yellow-500/20" />}
                  {m.roles?.some((r: any) => r.name === 'admin') && <Shield size={12} className="text-primary fill-primary/20" />}
              </div>
              {/* Custom Status Text (Dummy für jetzt) */}
              <div className="text-[10px] text-gray-500 truncate group-hover:text-gray-400">
                  {m.status === 'online' ? 'Bereit zum Zocken' : 'Offline'}
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