import { useState } from 'react';
import { MessageSquare, MoreVertical, Search, UserPlus, Check, X } from 'lucide-react';

export const FriendListStage = () => {
  const [activeTab, setActiveTab] = useState<'online' | 'all' | 'pending' | 'blocked'>('online');

  // Dummy Daten
  const friends = [
    { id: 1, name: 'Anna', status: 'online', activity: 'Spielt Visual Studio Code' },
    { id: 2, name: 'Ben', status: 'online', activity: 'Spotify' },
    { id: 3, name: 'Chris', status: 'offline', activity: 'Zuletzt online: vor 5 Min' },
  ];

  const pending = [
    { id: 4, name: 'Kevin', type: 'incoming' }
  ];

  return (
    <div className="flex flex-col h-full bg-dark-100">
      
      {/* Top Bar: Filter & Aktionen */}
      <div className="h-12 border-b border-dark-400 flex items-center px-4 shadow-sm bg-dark-100 z-10">
        <div className="flex items-center text-white font-bold mr-4 border-r border-gray-600 pr-4 gap-2">
           <span className="text-gray-400">Freunde</span>
        </div>
        
        <div className="flex items-center space-x-4 flex-1">
           <button onClick={() => setActiveTab('online')} className={`hover:bg-dark-300 px-2 py-1 rounded text-sm font-medium ${activeTab === 'online' ? 'text-white bg-dark-300' : 'text-gray-400'}`}>Online</button>
           <button onClick={() => setActiveTab('all')} className={`hover:bg-dark-300 px-2 py-1 rounded text-sm font-medium ${activeTab === 'all' ? 'text-white bg-dark-300' : 'text-gray-400'}`}>Alle</button>
           <button onClick={() => setActiveTab('pending')} className={`hover:bg-dark-300 px-2 py-1 rounded text-sm font-medium ${activeTab === 'pending' ? 'text-white bg-dark-300' : 'text-gray-400'}`}>Ausstehend</button>
           <button onClick={() => setActiveTab('blocked')} className={`hover:bg-dark-300 px-2 py-1 rounded text-sm font-medium ${activeTab === 'blocked' ? 'text-white bg-dark-300' : 'text-gray-400'}`}>Blockiert</button>
           
           <button className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-sm font-medium ml-auto flex items-center gap-1">
             <UserPlus size={16} /> Freund hinzufügen
           </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex">
         
         {/* Linke Seite: Liste */}
         <div className="flex-1 p-6 overflow-y-auto">
            
            {/* Suche */}
            <div className="mb-6 relative">
               <input 
                 type="text" 
                 placeholder="Suchen" 
                 className="w-full bg-dark-400 text-white p-2 pl-2 rounded border border-transparent focus:border-blue-500 outline-none transition-colors"
               />
               <Search className="absolute right-3 top-2.5 text-gray-500" size={18} />
            </div>

            <div className="text-xs font-bold text-gray-400 uppercase mb-4">
               {activeTab === 'online' ? `Online — ${friends.filter(f => f.status === 'online').length}` : 
                activeTab === 'pending' ? `Ausstehend — ${pending.length}` : 'Alle Freunde'}
            </div>

            <div className="space-y-2 border-t border-dark-400 pt-2">
               
               {/* Wenn Tab = Online oder Alle */}
               {(activeTab === 'online' || activeTab === 'all') && friends.map(friend => (
                 (activeTab === 'online' && friend.status === 'offline') ? null : (
                   <div key={friend.id} className="flex items-center justify-between group p-2.5 rounded hover:bg-dark-300/50 cursor-pointer border-t border-dark-400/30 first:border-none">
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-full bg-gray-500 relative">
                            <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-[3px] border-dark-100 rounded-full ${friend.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                         </div>
                         <div>
                            <div className="font-bold text-white flex items-center gap-1">
                               {friend.name} 
                               <span className="text-gray-500 text-xs hidden group-hover:inline">#1234</span>
                            </div>
                            <div className="text-xs text-gray-400">{friend.activity}</div>
                         </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 bg-dark-400 p-1 rounded transition-opacity">
                         <button className="p-2 bg-dark-300 rounded-full hover:text-white text-gray-400" title="Nachricht"><MessageSquare size={18} /></button>
                         <button className="p-2 bg-dark-300 rounded-full hover:text-white text-gray-400" title="Mehr"><MoreVertical size={18} /></button>
                      </div>
                   </div>
                 )
               ))}

               {/* Wenn Tab = Ausstehend */}
               {activeTab === 'pending' && pending.map(req => (
                   <div key={req.id} className="flex items-center justify-between group p-2.5 rounded hover:bg-dark-300/50 cursor-pointer">
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-full bg-yellow-500 flex items-center justify-center font-bold text-white">?</div>
                         <div>
                            <div className="font-bold text-white">{req.name}</div>
                            <div className="text-xs text-gray-400">Eingehende Freundschaftsanfrage</div>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <button className="p-2 bg-dark-300 rounded-full hover:bg-green-500 text-white transition-colors"><Check size={18} /></button>
                         <button className="p-2 bg-dark-300 rounded-full hover:bg-red-500 text-white transition-colors"><X size={18} /></button>
                      </div>
                   </div>
               ))}

            </div>
         </div>

         {/* Rechte Seite: "Jetzt aktiv" (Optional, wie bei Discord) */}
         <div className="w-80 border-l border-dark-400 p-4 hidden xl:block">
            <h3 className="text-xl font-bold text-white mb-4">Jetzt aktiv</h3>
            <div className="text-center mt-10 text-gray-400">
               <div className="font-bold">Momentan ist alles ruhig.</div>
               <div className="text-sm mt-1">Wenn Freunde anfangen zu spielen oder zu reden, erscheinen sie hier!</div>
            </div>
         </div>

      </div>
    </div>
  );
};