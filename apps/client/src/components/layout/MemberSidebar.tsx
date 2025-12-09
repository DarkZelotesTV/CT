import { useState, useEffect } from 'react';
import axios from 'axios';
import { User } from 'lucide-react';
import { getServerUrl } from '../../utils/apiConfig';

interface Member {
  userId: number;
  username: string;
  avatarUrl?: string;
  status: 'online' | 'offline';
  joinedAt: string;
}

interface MemberSidebarProps {
  serverId: number | null;
}

export const MemberSidebar = ({ serverId }: MemberSidebarProps) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!serverId) return;
    const fetchMembers = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('clover_token');
        const res = await axios.get(`${getServerUrl()}/api/servers/${serverId}/members`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMembers(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, [serverId]);

  const onlineMembers = members.filter(m => m.status === 'online');
  const offlineMembers = members.filter(m => m.status !== 'online');

  return (
    <div className="w-60 bg-dark-200 flex flex-col border-l border-dark-400 h-full">
      <div className="p-4 shadow-sm border-b border-dark-400 font-bold text-gray-300 uppercase text-xs tracking-wider flex justify-between">
        <span>Mitglieder — {members.length}</span>
        {loading && <span className="text-green-500">...</span>}
      </div>
      <div className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
        {onlineMembers.length > 0 && (
          <div className="mb-4">
            <div className="px-2 mb-1 text-[10px] font-bold text-gray-400 uppercase">Online — {onlineMembers.length}</div>
            {onlineMembers.map(m => <MemberItem key={m.userId} member={m} />)}
          </div>
        )}
        {offlineMembers.length > 0 && (
          <div>
            <div className="px-2 mb-1 text-[10px] font-bold text-gray-400 uppercase">Offline — {offlineMembers.length}</div>
            {offlineMembers.map(m => <MemberItem key={m.userId} member={m} />)}
          </div>
        )}
      </div>
    </div>
  );
};

const MemberItem = ({ member }: { member: Member }) => (
  <div className="flex items-center p-2 rounded hover:bg-dark-300 cursor-pointer group transition-colors">
    <div className="w-8 h-8 rounded-full bg-dark-400 flex items-center justify-center mr-3 relative">
      {member.avatarUrl ? <img src={member.avatarUrl} className="w-full h-full rounded-full" /> : <User size={16} className="text-gray-400" />}
      <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-dark-200 rounded-full ${member.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`} />
    </div>
    <div className="overflow-hidden">
      <div className="text-sm font-semibold text-gray-200 group-hover:text-white truncate">{member.username}</div>
    </div>
  </div>
);