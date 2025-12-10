import { useState, useEffect } from 'react';
import axios from 'axios';
import { User, Shield } from 'lucide-react';
import { getServerUrl } from '../../utils/apiConfig';

// Interfaces...

export const MemberSidebar = ({ serverId }: any) => {
  const [members, setMembers] = useState<any[]>([]);
  
  // Dein Fetch Code...

  const renderMember = (m: any) => (
      <div key={m.userId} className="flex items-center p-2 mb-2 bg-gray-900/40 border border-transparent hover:border-cyan-500/30 rounded transition-all group cursor-pointer">
          <div className="w-8 h-8 bg-gray-800 rounded mr-3 relative overflow-hidden">
              {m.avatarUrl ? <img src={m.avatarUrl} className="w-full h-full object-cover" /> : <User size={16} className="m-auto mt-2 text-gray-600" />}
              {/* Status Dot */}
              <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-black ${m.status === 'online' ? 'bg-green-500' : 'bg-gray-600'}`}></div>
          </div>
          <div className="overflow-hidden">
              <div className="text-xs font-bold text-gray-400 group-hover:text-cyan-400 tracking-wide truncate">{m.username}</div>
              <div className="text-[9px] text-gray-600 uppercase tracking-wider group-hover:text-cyan-700">
                  {m.status === 'online' ? 'Active Duty' : 'Offline'}
              </div>
          </div>
      </div>
  );

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="h-12 border-b border-cyan-900/30 flex items-center px-4">
        <Shield className="w-4 h-4 text-cyan-600 mr-2" />
        <span className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase">Active Personnel</span>
        <span className="ml-auto text-[10px] bg-cyan-900/20 text-cyan-500 px-1.5 py-0.5 rounded">{members.length}</span>
      </div>

      <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
          {/* Online */}
          <div className="mb-6">
              <div className="text-[10px] text-gray-600 mb-2 px-1 uppercase tracking-widest border-b border-gray-800 pb-1 w-1/2">On Deck</div>
              {members.filter(m => m.status === 'online').map(renderMember)}
          </div>
           {/* Offline */}
           <div>
              <div className="text-[10px] text-gray-600 mb-2 px-1 uppercase tracking-widest border-b border-gray-800 pb-1 w-1/2">Reserves</div>
              {members.filter(m => m.status !== 'online').map(renderMember)}
          </div>
      </div>
    </div>
  );
};