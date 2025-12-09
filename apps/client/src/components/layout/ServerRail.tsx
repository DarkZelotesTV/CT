import { useState, useEffect } from 'react';
import axios from 'axios';
import { Monitor, Plus, Compass } from 'lucide-react';
import classNames from 'classnames';

// Utilities & Modals
import { getServerUrl } from '../../utils/apiConfig';
import { CreateServerModal } from '../modals/CreateServerModal';
import { JoinServerModal } from '../modals/JoinServerModal';

// Typ-Definition für Server-Daten aus dem Backend
interface Server {
  id: number;
  name: string;
  icon_url?: string;
}

// Props: Wir bekommen den aktuellen Status vom MainLayout
interface ServerRailProps {
  selectedServerId: number | null;
  onSelectServer: (id: number | null) => void;
}

export const ServerRail = ({ selectedServerId, onSelectServer }: ServerRailProps) => {
  const [servers, setServers] = useState<Server[]>([]);
  
  // State für die beiden Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Funktion zum Laden der Server-Liste vom Backend
  const fetchServers = async () => {
    try {
      const token = localStorage.getItem('clover_token');
      // Ruft alle Server ab, bei denen der User Mitglied ist
      const res = await axios.get(`${getServerUrl()}/api/servers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServers(res.data);
    } catch (err) {
      console.error("Konnte Server nicht laden:", err);
    }
  };

  // Beim Start einmalig laden
  useEffect(() => {
    fetchServers();
  }, []);

  return (
    <>
      <div className="w-[72px] bg-dark-400 flex flex-col items-center py-3 space-y-2 overflow-y-auto h-full no-scrollbar">
        
        {/* ==========================
            1. HOME BUTTON (Dashboard)
            ========================== */}
        <div 
          onClick={() => onSelectServer(null)}
          className={classNames(
            "w-12 h-12 rounded-[24px] transition-all duration-300 flex items-center justify-center cursor-pointer group mb-2 relative",
            selectedServerId === null ? "bg-primary rounded-[16px]" : "bg-dark-100 hover:bg-primary hover:rounded-[16px]"
          )}
          title="Home / Freunde"
        >
          <Monitor className={selectedServerId === null ? "text-white" : "text-gray-400 group-hover:text-white"} size={28} />
          
          {/* Aktiver Indikator (Weißer Balken links) */}
          {selectedServerId === null && (
             <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-2 h-8 rounded-r-full bg-white transition-all" />
          )}
        </div>

        {/* Trennlinie */}
        <div className="w-8 h-[2px] bg-dark-200 rounded-full mx-auto my-2" />

        {/* ==========================
            2. SERVER LISTE
            ========================== */}
        {servers.map((server) => (
          <div 
            key={server.id} 
            onClick={() => onSelectServer(server.id)}
            className={classNames(
              "w-12 h-12 rounded-[24px] transition-all duration-300 flex items-center justify-center cursor-pointer group relative bg-cover bg-center shrink-0",
              selectedServerId === server.id ? "rounded-[16px] ring-2 ring-primary ring-offset-2 ring-offset-dark-400" : "bg-dark-200 hover:rounded-[16px] hover:bg-green-600"
            )}
            title={server.name}
          >
             {/* Icon Logik: Bild oder Initialen */}
             {server.icon_url ? (
               <img 
                 src={server.icon_url} 
                 alt={server.name} 
                 className="w-full h-full object-cover rounded-[inherit]" 
               />
             ) : (
                <span className="text-white font-bold">{server.name.substring(0, 2).toUpperCase()}</span>
             )}
             
             {/* Aktiver Indikator (Weißer Balken links) */}
             {selectedServerId === server.id && (
                <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-2 h-8 rounded-r-full bg-white transition-all" />
             )}
             
             {/* Hover Indikator (Kleiner Punkt wenn nicht aktiv) */}
             {selectedServerId !== server.id && (
                <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-r-full bg-white opacity-0 group-hover:opacity-100 transition-all" />
             )}
          </div>
        ))}

        {/* ==========================
            3. ACTIONS (Erstellen / Beitreten)
            ========================== */}
        
        {/* Server Erstellen (+) */}
        <div 
            onClick={() => setShowCreateModal(true)}
            className="w-12 h-12 bg-dark-200 rounded-[24px] hover:rounded-[16px] hover:bg-green-500 transition-all duration-300 flex items-center justify-center cursor-pointer text-green-500 hover:text-white mt-2 group shrink-0"
            title="Server erstellen"
        >
          <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300"/>
        </div>

        {/* Server Beitreten (Kompass) */}
        <div 
            onClick={() => setShowJoinModal(true)}
            className="w-12 h-12 bg-dark-200 rounded-[24px] hover:rounded-[16px] hover:bg-green-500 transition-all duration-300 flex items-center justify-center cursor-pointer text-green-500 hover:text-white mt-2 group shrink-0"
            title="Server beitreten"
        >
          <Compass size={24} />
        </div>

      </div>

      {/* ==========================
          MODALS
          ========================== */}
      
      {showCreateModal && (
        <CreateServerModal 
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { 
              fetchServers(); // Liste neu laden
          }}
        />
      )}

      {showJoinModal && (
        <JoinServerModal
          onClose={() => setShowJoinModal(false)}
          onJoined={() => { 
              fetchServers(); // Liste neu laden
          }}
        />
      )}
    </>
  );
};