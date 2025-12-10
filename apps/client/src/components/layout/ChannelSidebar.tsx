import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Hash, Volume2, Settings, Plus, ChevronDown, ChevronRight, Globe, Mic, Shield } from 'lucide-react';
import { getServerUrl } from '../../utils/apiConfig';
import { CreateChannelModal } from '../modals/CreateChannelModal';
import { UserBottomBar } from './UserBottomBar';
import { ServerSettingsModal } from '../modals/ServerSettingsModal';

interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice' | 'web';
  custom_icon?: string;
}

interface Category {
  id: number;
  name: string;
  channels: Channel[];
}

interface ChannelSidebarProps {
  serverId: number | null;
  activeChannelId: number | null;
  onSelectChannel: (channel: Channel) => void;
}

export const ChannelSidebar = ({ serverId, activeChannelId, onSelectChannel }: ChannelSidebarProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [uncategorized, setUncategorized] = useState<Channel[]>([]);
  const [serverName, setServerName] = useState('Server');
  
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [createType, setCreateType] = useState<'text' | 'voice' | 'web'>('text');

  const fetchData = useCallback(async () => {
    if (!serverId) return;
    try {
      const token = localStorage.getItem('clover_token');
      const srvRes = await axios.get(`${getServerUrl()}/api/servers`, { headers: { Authorization: `Bearer ${token}` } });
      const current = srvRes.data.find((s: any) => s.id === serverId);
      if (current) setServerName(current.name);

      const structRes = await axios.get(`${getServerUrl()}/api/servers/${serverId}/structure`, {
          headers: { Authorization: `Bearer ${token}` }
      });
      setCategories(structRes.data.categories);
      setUncategorized(structRes.data.uncategorized);
    } catch (err) { console.error(err); }
  }, [serverId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleCategory = (id: number) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  const openCreate = (type: any) => { setCreateType(type); setShowCreateModal(true); };

  // Render Channel Item (TeamSpeak Style: Compact, High Contrast Selection)
  const renderChannel = (c: Channel, isInsideCategory = false) => {
    const Icon = c.type === 'web' ? Globe : c.type === 'voice' ? Volume2 : Hash;
    const isActive = activeChannelId === c.id;
    
    return (
      <div 
        key={c.id} 
        onClick={() => onSelectChannel(c)}
        className={`
            relative flex items-center px-2 py-1 mb-[1px] cursor-pointer group select-none
            ${isActive 
                ? 'bg-ts-accent/20 text-blue-400 border-l-2 border-blue-500' 
                : 'text-gray-400 hover:bg-ts-hover hover:text-gray-200 border-l-2 border-transparent'}
            transition-all duration-100 ease-out
            ${isInsideCategory ? 'ml-4' : 'mx-2 rounded-sm'}
        `}
      >
        {/* Verbindungslinie für Tree-View-Feeling */}
        {isInsideCategory && (
            <div className="absolute left-[-10px] top-0 bottom-0 w-[1px] bg-ts-border group-hover:bg-ts-border/80"></div>
        )}
        
        {c.custom_icon ? (
          <span className="mr-2 text-sm w-[18px] text-center">{c.custom_icon}</span>
        ) : (
          <Icon size={16} className={`mr-2 ${isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-400'}`} />
        )}
        
        <span className={`text-sm truncate flex-1 font-medium ${isActive ? 'text-white shadow-glow' : ''}`}>
            {c.name}
        </span>

        {/* Tech-Badge bei Voice (z.B. User Count dummy) */}
        {c.type === 'voice' && (
            <span className="text-[10px] font-mono text-gray-600 bg-ts-base px-1 rounded border border-ts-border opacity-0 group-hover:opacity-100 transition-opacity">
                0
            </span>
        )}
      </div>
    );
  };

  if (!serverId) return null;

  return (
    <>
      <div className="w-64 bg-ts-surface flex flex-col h-full border-r border-ts-border relative shadow-xl">
        
        {/* HEADER: Technischer Look mit Gradient */}
        <div 
          onClick={() => setShowSettingsModal(true)} 
          className="h-14 tech-border flex items-center px-4 cursor-pointer hover:bg-ts-hover transition-colors bg-gradient-to-r from-ts-surface to-ts-base"
        >
          <div className="flex-1 overflow-hidden">
             <div className="font-bold text-white text-sm uppercase tracking-wide truncate">{serverName}</div>
             <div className="text-[10px] text-green-500 flex items-center gap-1 font-mono mt-0.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                ONLINE
             </div>
          </div>
          <Settings size={18} className="text-gray-500 hover:text-white transition-colors" /> 
        </div>

        {/* CHANNEL LISTE */}
        <div className="flex-1 overflow-y-auto pt-4 pb-2 px-2 custom-scrollbar">
          
          {uncategorized.map(c => renderChannel(c, false))}

          {categories.map(cat => (
            <div key={cat.id} className="mt-4 relative">
              {/* Category Header */}
              <div 
                className="flex items-center justify-between group text-gray-500 hover:text-gray-300 cursor-pointer mb-1 pl-1"
                onClick={() => toggleCategory(cat.id)}
              >
                 <div className="flex items-center gap-1">
                     {collapsed[cat.id] ? <ChevronRight size={10}/> : <ChevronDown size={10}/>}
                     <span className="text-[11px] font-bold uppercase tracking-wider font-mono">{cat.name}</span>
                 </div>
                 <Plus 
                    size={14} 
                    className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity mr-2" 
                    onClick={(e) => { e.stopPropagation(); openCreate('text'); }} 
                 />
              </div>
              
              {/* Category Content mit Indentation Line */}
              {!collapsed[cat.id] && (
                  <div className="relative border-l border-ts-border/50 ml-2 pl-0 space-y-0.5">
                      {cat.channels.map(c => renderChannel(c, true))}
                  </div>
              )}
            </div>
          ))}

          {categories.length === 0 && uncategorized.length === 0 && (
             <div className="p-6 text-center opacity-50">
                <div className="border border-dashed border-gray-600 rounded p-4">
                    <p className="text-xs text-gray-400 mb-3">Server ist leer.</p>
                    <button onClick={() => openCreate('text')} className="text-xs bg-ts-accent/20 text-blue-400 hover:text-white px-3 py-1.5 rounded transition-all">
                        Kanal erstellen
                    </button>
                </div>
             </div>
          )}
        </div>
        
        {/* USER FOOTER: Docked at bottom, tech style */}
        <div className="tech-border border-t bg-ts-base/50 p-0">
             <UserBottomBar />
        </div>

      </div>

      {showCreateModal && (
        <CreateChannelModal 
            serverId={serverId} 
            defaultType={createType}
            onClose={() => setShowCreateModal(false)} 
            onCreated={fetchData} 
        />
      )}

      {showSettingsModal && (
        <ServerSettingsModal
            serverId={serverId}
            onClose={() => setShowSettingsModal(false)}
        />
      )}
    </>
  );
};