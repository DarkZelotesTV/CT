import { useState, useEffect } from 'react';
import classNames from 'classnames';
import { Hexagon, Plus } from 'lucide-react';
// Imports...

export const ServerRail = ({ selectedServerId, onSelectServer }: any) => {
  const [servers, setServers] = useState<any[]>([]); // Dummy Typ
  // fetchServers...

  const ServerIcon = ({ id, name, icon, active, onClick }: any) => (
    <div className="group relative w-12 h-12 flex items-center justify-center my-2 cursor-pointer" onClick={onClick}>
        {/* Active Pill Indicator (Animated) */}
        <div className={classNames(
            "absolute left-[-14px] w-1.5 bg-white rounded-r-lg transition-all duration-300 ease-out",
            active ? "h-8 opacity-100" : "h-2 opacity-0 group-hover:opacity-50 group-hover:h-4"
        )} />

        {/* The Icon Container */}
        <div className={classNames(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg overflow-hidden border",
            active 
                ? "bg-command-accent text-white border-transparent scale-105" 
                : "bg-command-surface border-white/5 text-command-muted hover:bg-command-panel hover:text-white hover:border-white/20 hover:scale-105"
        )}>
            {icon ? (
                <img src={icon} className="w-full h-full object-cover" />
            ) : (
                <span className="font-semibold text-xs">{name.substring(0,2).toUpperCase()}</span>
            )}
        </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center py-2 w-[72px] h-full no-scrollbar">
       <ServerIcon 
          active={selectedServerId === null} 
          onClick={() => onSelectServer(null)} 
          name="Home" 
          icon={null} // Hier könnte ein Home Icon hin
       />
       
       <div className="w-8 h-[1px] bg-white/10 rounded-full my-2" />
       
       {servers.map(s => (
           <ServerIcon key={s.id} {...s} active={selectedServerId === s.id} onClick={() => onSelectServer(s.id)} />
       ))}

       <div className="mt-auto">
            <button className="w-12 h-12 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-green-500 hover:bg-green-500 hover:text-white hover:border-green-500 transition-all duration-300 group">
                <Plus size={20} className="group-hover:rotate-90 transition-transform" />
            </button>
       </div>
    </div>
  );
};