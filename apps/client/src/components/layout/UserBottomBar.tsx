import { Mic, Headphones, Settings } from 'lucide-react';

export const UserBottomBar = () => {
  // Wir holen die echten Daten aus dem Speicher
  const user = JSON.parse(localStorage.getItem('clover_user') || '{}');
  const username = user.username || 'Gast';
  // Fallback ID, falls keine da ist
  const discriminator = user.id ? `#${user.id.toString().padStart(4, '0')}` : '#0000';

  return (
    <div className="bg-dark-400/80 p-2 flex items-center gap-2 border-t border-dark-300 flex-shrink-0">
      
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-xs relative cursor-pointer hover:opacity-80 transition group">
          {username.substring(0, 2).toUpperCase()}
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-dark-400 rounded-full" title="Online"></div>
      </div>
      
      {/* Name & ID */}
      <div className="flex-1 overflow-hidden cursor-pointer group">
        <div className="text-sm font-bold text-white truncate group-hover:underline">{username}</div>
        <div className="text-xs text-gray-400 group-hover:text-gray-300">{discriminator}</div>
      </div>
      
      {/* Buttons */}
      <div className="flex">
           <button className="p-1.5 hover:bg-dark-300 rounded text-gray-200 hover:text-white transition-colors relative group" title="Stummschalten">
             <Mic size={18} />
           </button>
           <button className="p-1.5 hover:bg-dark-300 rounded text-gray-200 hover:text-white transition-colors" title="Taubstellen">
             <Headphones size={18} />
           </button>
           <button className="p-1.5 hover:bg-dark-300 rounded text-gray-200 hover:text-white transition-colors" title="Einstellungen">
             <Settings size={18} />
           </button>
      </div>
    </div>
  );
};