import { useState, useEffect } from 'react';
import { Home, Plus, Loader2 } from 'lucide-react'; // WICHTIG: 'Home' statt 'House'
import { apiFetch } from '../../api/http';
import { CreateServerModal } from '../modals/CreateServerModal';

interface ServerRailProps {
  selectedServerId: number | null;
  onSelectServer: (id: number | null) => void;
}

interface Server {
  id: number;
  name: string;
  icon_url?: string;
}

export const ServerRail = ({ selectedServerId, onSelectServer }: ServerRailProps) => {
  const [servers, setServers] = useState<Server[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchServers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Server[]>(`/api/servers`);
      setServers(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchServers(); }, []);

  return (
    <>
      <div className="w-full h-full flex flex-col items-center gap-4 py-4 overflow-y-auto no-scrollbar">
        
        {/* HOME BUTTON (Symbol) */}
        <div 
           onClick={() => onSelectServer(null)}
           className={`
             w-12 h-12 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-300 group relative
             ${selectedServerId === null 
                ? 'bg-indigo-500 rounded-[16px] shadow-lg shadow-indigo-500/20 text-white' 
                : 'bg-white/5 hover:bg-indigo-500 hover:text-white text-gray-400 rounded-[24px] hover:rounded-[16px]'}
           `}
        >
            <Home size={22} />
        </div>

        {/* Trenner (ganz dezent) */}
        <div className="w-8 h-[2px] bg-white/5 rounded-full flex-shrink-0" />

        {/* SERVER LISTE */}
        {loading && <Loader2 className="animate-spin text-gray-600" />}
        
        {servers.map((server) => (
           <div 
             key={server.id}
             onClick={() => onSelectServer(server.id)}
             className={`
               w-12 h-12 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-300 relative group
               ${selectedServerId === server.id ? 'rounded-[16px]' : 'rounded-[24px] hover:rounded-[16px]'}
               bg-white/5 hover:bg-white/10
             `}
           >
              {/* Aktiver Balken (Links) */}
              <div className={`absolute left-[-12px] w-1 bg-white rounded-r-full transition-all duration-300
                  ${selectedServerId === server.id ? 'h-8 opacity-100' : 'h-2 opacity-0 group-hover:opacity-50 group-hover:h-4'}
              `}></div>

              {server.icon_url ? (
                  <img src={server.icon_url} alt={server.name} className={`w-full h-full object-cover transition-all ${selectedServerId === server.id ? 'rounded-[16px]' : 'rounded-[24px] group-hover:rounded-[16px]'}`} />
              ) : (
                  <span className="text-gray-200 font-bold text-sm group-hover:text-white transition-colors">{server.name.substring(0, 2).toUpperCase()}</span>
              )}
           </div>
        ))}

        {/* ADD BUTTON */}
        <div 
            onClick={() => setShowCreateModal(true)}
            className="w-12 h-12 flex-shrink-0 rounded-[24px] bg-white/5 hover:bg-green-500/20 flex items-center justify-center cursor-pointer text-green-500 transition-all duration-300 mt-2 hover:rounded-[16px] group"
        >
            <Plus size={22} className="group-hover:text-green-400" />
        </div>

      </div>

      {showCreateModal && (
        <CreateServerModal 
            onClose={() => setShowCreateModal(false)} 
            onCreated={fetchServers} 
        />
      )}
    </>
  );
};