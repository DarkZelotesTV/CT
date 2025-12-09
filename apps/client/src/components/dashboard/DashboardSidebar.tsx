import { Users, Mail, Plus } from 'lucide-react';
import { UserBottomBar } from '../layout/UserBottomBar'; // Importieren

export const DashboardSidebar = () => {
  const directMessages = [
    { id: 1, name: 'Anna', status: 'online', avatar: 'A' },
    { id: 2, name: 'Ben', status: 'idle', avatar: 'B' },
    { id: 3, name: 'Gruppe: Raid', status: 'dnd', avatar: 'G', isGroup: true },
  ];

  return (
    <div className="w-60 bg-dark-200 flex flex-col h-full border-r border-dark-300">
      {/* Suche */}
      <div className="p-3 shadow-sm border-b border-dark-400">
        <button className="w-full text-left bg-dark-400 text-gray-400 text-sm px-2 py-1.5 rounded hover:text-gray-200 transition-colors truncate">
          Suchen oder Gespräch beginnen
        </button>
      </div>

      {/* Navigation */}
      <div className="p-2 space-y-0.5">
        <div className="flex items-center px-2 py-2 rounded bg-dark-300/60 text-white cursor-pointer font-medium">
          <Users size={20} className="mr-3 text-gray-200" />
          Freunde
        </div>
        <div className="flex items-center px-2 py-2 rounded hover:bg-dark-300 text-gray-400 hover:text-gray-200 cursor-pointer font-medium">
          <Mail size={20} className="mr-3 text-gray-400" />
          Anfragen
          <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 rounded-full">1</span>
        </div>
      </div>

      {/* DMs Header */}
      <div className="mt-4 px-4 flex items-center justify-between group text-gray-400 hover:text-gray-200 cursor-pointer">
        <span className="text-xs font-bold uppercase hover:text-gray-200">Direktnachrichten</span>
        <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* DM Liste */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 mt-1 custom-scrollbar">
        {directMessages.map((dm) => (
          <div key={dm.id} className="flex items-center px-2 py-1.5 rounded hover:bg-dark-300 cursor-pointer group">
            <div className="relative mr-3">
               <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white">
                 {dm.avatar}
               </div>
               <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-dark-200 rounded-full 
                 ${dm.status === 'online' ? 'bg-green-500' : 
                   dm.status === 'idle' ? 'bg-yellow-500' : 
                   'bg-red-500'}`} 
               />
            </div>
            <div className="flex-1 overflow-hidden">
               <div className="text-gray-300 font-medium truncate group-hover:text-white">{dm.name}</div>
               <div className="text-xs text-gray-500 truncate">{dm.isGroup ? '3 Mitglieder' : 'Online'}</div>
            </div>
          </div>
        ))}
      </div>

      {/* HIER IST DAS UPDATE: Die zentrale Komponente nutzen */}
      <UserBottomBar />
      
    </div>
  );
};