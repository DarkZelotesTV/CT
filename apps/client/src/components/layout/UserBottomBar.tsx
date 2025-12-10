import { Mic, Headphones, Settings } from 'lucide-react';

export const UserBottomBar = () => {
  const user = JSON.parse(localStorage.getItem('clover_user') || '{}');
  const username = user.username || 'Trooper';

  return (
    <div className="p-3 bg-[#0a0a0a] flex items-center gap-3">
      <div className="w-8 h-8 bg-cyan-700/20 border border-cyan-500/50 rounded flex items-center justify-center text-cyan-400 font-bold text-xs relative">
          {username.substring(0, 1).toUpperCase()}
          <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-black animate-pulse"></div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <div className="text-xs font-bold text-gray-300 truncate tracking-wider">{username}</div>
        <div className="text-[9px] text-cyan-600 uppercase tracking-widest">ID: {user.id || '7567'}</div>
      </div>
      
      <div className="flex gap-1">
           <button className="p-1 hover:bg-cyan-900/30 rounded text-gray-500 hover:text-cyan-400"><Mic size={14} /></button>
           <button className="p-1 hover:bg-cyan-900/30 rounded text-gray-500 hover:text-cyan-400"><Headphones size={14} /></button>
           <button className="p-1 hover:bg-cyan-900/30 rounded text-gray-500 hover:text-cyan-400"><Settings size={14} /></button>
      </div>
    </div>
  );
};