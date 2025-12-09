import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Hash, Volume2, Plus, ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { getServerUrl } from '../../utils/apiConfig';
import { CreateChannelModal } from '../modals/CreateChannelModal';

// Typen
interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice';
  custom_icon?: string;
}

interface Category {
  id: number;
  name: string;
  channels: Channel[];
}

interface ChannelSidebarProps {
  serverId: number | null;
  activeChannelId: number | null; // NEU: Damit wir wissen, was markiert ist
  onSelectChannel: (channel: Channel) => void; // NEU: Callback nach oben
}

export const ChannelSidebar = ({ serverId, activeChannelId, onSelectChannel }: ChannelSidebarProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [uncategorized, setUncategorized] = useState<Channel[]>([]);
  const [serverName, setServerName] = useState('Laden...');
  
  // Collapsed State für Kategorien (ID -> boolean)
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Daten laden
  const fetchData = useCallback(async () => {
    if (!serverId) return;
    try {
      const token = localStorage.getItem('clover_token');
      
      // Server Name (kurzgefasst)
      const srvRes = await axios.get(`${getServerUrl()}/api/servers`, { headers: { Authorization: `Bearer ${token}` }});
      const current = srvRes.data.find((s: any) => s.id === serverId);
      if (current) setServerName(current.name);

      // Struktur laden (Der neue Endpoint!)
      const structRes = await axios.get(`${getServerUrl()}/api/servers/${serverId}/structure`, {
          headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(structRes.data.categories);
      setUncategorized(structRes.data.uncategorized);

    } catch (err) {
      console.error(err);
    }
  }, [serverId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleCategory = (id: number) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Renderer für einen einzelnen Kanal
  const renderChannel = (c: Channel) => {
    // Icon Logik: Custom > Type-Default
    const Icon = c.type === 'voice' ? Volume2 : Hash;
    
    return (
      <div 
        key={c.id} 
        onClick={() => onSelectChannel(c)}
        className={`flex items-center px-2 py-1.5 mx-2 rounded cursor-pointer group transition-colors mb-0.5
          ${activeChannelId === c.id ? 'bg-dark-300 text-white' : 'text-gray-400 hover:bg-dark-300 hover:text-gray-200'}
        `}
      >
        {/* Custom Icon (Emoji oder String) oder Standard SVG */}
        {c.custom_icon ? (
          <span className="mr-2 text-lg w-[20px] text-center">{c.custom_icon}</span>
        ) : (
          <Icon size={18} className="text-gray-500 mr-1.5" />
        )}
        
        <span className="font-medium truncate flex-1">{c.name}</span>
      </div>
    );
  };

  if (!serverId) return null;

  return (
    <>
      <div className="w-60 bg-dark-200 flex flex-col h-full border-r border-dark-300">
        
        {/* Header mit Einstellungen */}
        <div className="h-12 border-b border-dark-400 flex items-center px-4 font-bold text-white shadow-sm hover:bg-dark-300 cursor-pointer justify-between transition-colors">
          <span className="truncate">{serverName}</span>
          <Settings size={16} /> 
        </div>

        {/* Scrollbare Liste */}
        <div className="flex-1 overflow-y-auto pt-3 custom-scrollbar">
          
          {/* 1. Unkategorisierte Kanäle */}
          {uncategorized.map(renderChannel)}

          {/* 2. Kategorien */}
          {categories.map(cat => (
            <div key={cat.id} className="mt-4">
              {/* Kategorie Header */}
              <div 
                className="px-2 flex items-center justify-between group text-gray-400 hover:text-gray-200 cursor-pointer mb-1"
                onClick={() => toggleCategory(cat.id)}
              >
                 <div className="text-xs font-bold uppercase flex items-center gap-0.5 hover:text-white transition-colors">
                     {collapsed[cat.id] ? <ChevronRight size={12}/> : <ChevronDown size={12}/>}
                     <span>{cat.name}</span>
                 </div>
                 <Plus 
                    size={14} 
                    className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity" 
                    onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }} // Hier könnte man categoryId übergeben
                 />
              </div>

              {/* Kanäle der Kategorie (wenn nicht eingeklappt) */}
              {!collapsed[cat.id] && cat.channels.map(renderChannel)}
            </div>
          ))}

          {/* Fallback Button für leere Server */}
          {categories.length === 0 && uncategorized.length === 0 && (
             <div className="p-4 text-center">
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="text-xs bg-dark-400 hover:bg-green-600 text-white px-3 py-2 rounded transition-colors"
                >
                  Ersten Kanal erstellen
                </button>
             </div>
          )}

        </div>
        
        {/* User Footer (bleibt gleich wie vorher) */}
        {/* ... (Code vom vorherigen User Footer hier einfügen) ... */}
      </div>

      {showCreateModal && (
        <CreateChannelModal 
            serverId={serverId} 
            onClose={() => setShowCreateModal(false)} 
            onCreated={fetchData} 
        />
      )}
    </>
  );
};