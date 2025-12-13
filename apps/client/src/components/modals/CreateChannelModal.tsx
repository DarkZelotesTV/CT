import { useState } from 'react';
import { X, Loader2, Hash, Volume2, Globe } from 'lucide-react';
import { apiFetch } from '../../api/http';
import classNames from 'classnames';

interface CreateChannelModalProps {
  serverId: number;
  defaultType?: 'text' | 'voice' | 'web';
  onClose: () => void;
  onCreated: () => void;
}

export const CreateChannelModal = ({ serverId, defaultType = 'text', onClose, onCreated }: CreateChannelModalProps) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'voice' | 'web'>(defaultType);
  const [loading, setLoading] = useState(false);
  const [defaultPassword, setDefaultPassword] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await apiFetch(`/api/servers/${serverId}/channels`, {
        method: 'POST',
        body: JSON.stringify({ name, type, defaultPassword, joinPassword })
      });

      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Fehler beim Erstellen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-dark-200 w-full max-w-md rounded-lg shadow-2xl border border-dark-400 overflow-hidden transform scale-100 no-drag">
        
        {/* Header */}
        <div className="p-6 pb-2 flex justify-between items-center">
           <h2 className="text-xl font-bold text-white uppercase tracking-wide">Kanal erstellen</h2>
           <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
           
           {/* Typ Auswahl */}
           <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Kanaltyp</label>
              
              {/* Text Option */}
              <div 
                onClick={() => setType('text')}
                className={classNames(
                  "flex items-center p-3 rounded cursor-pointer border hover:bg-dark-300 transition-colors",
                  type === 'text' ? "bg-dark-300 border-dark-400" : "bg-transparent border-transparent"
                )}
              >
                 <Hash size={24} className="text-gray-400 mr-3" />
                 <div className="flex-1">
                    <div className="text-white font-bold">Text</div>
                    <div className="text-xs text-gray-400">Nachrichten, Bilder, Emojis senden.</div>
                 </div>
                 <div className={classNames("w-5 h-5 rounded-full border-2 flex items-center justify-center", type === 'text' ? "border-white" : "border-gray-500")}>
                    {type === 'text' && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                 </div>
              </div>

              {/* Voice Option */}
              <div 
                onClick={() => setType('voice')}
                className={classNames(
                  "flex items-center p-3 rounded cursor-pointer border hover:bg-dark-300 transition-colors",
                  type === 'voice' ? "bg-dark-300 border-dark-400" : "bg-transparent border-transparent"
                )}
              >
                 <Volume2 size={24} className="text-gray-400 mr-3" />
                 <div className="flex-1">
                    <div className="text-white font-bold">Sprache</div>
                    <div className="text-xs text-gray-400">Zusammen abhängen, reden, streamen.</div>
                 </div>
                 <div className={classNames("w-5 h-5 rounded-full border-2 flex items-center justify-center", type === 'voice' ? "border-white" : "border-gray-500")}>
                    {type === 'voice' && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                 </div>
              </div>

              {/* Web Option (NEU) */}
              <div 
                onClick={() => setType('web')}
                className={classNames(
                  "flex items-center p-3 rounded cursor-pointer border hover:bg-dark-300 transition-colors",
                  type === 'web' ? "bg-dark-300 border-dark-400" : "bg-transparent border-transparent"
                )}
              >
                 <Globe size={24} className="text-gray-400 mr-3" />
                 <div className="flex-1">
                    <div className="text-white font-bold">Webseite</div>
                    <div className="text-xs text-gray-400">Eine HTML Startseite für deinen Server.</div>
                 </div>
                 <div className={classNames("w-5 h-5 rounded-full border-2 flex items-center justify-center", type === 'web' ? "border-white" : "border-gray-500")}>
                    {type === 'web' && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                 </div>
              </div>
           </div>

           {/* Name Input */}
           <div>
             <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Kanalname</label>
             <div className="bg-dark-400 flex items-center px-3 rounded border border-transparent focus-within:border-primary">
                {type === 'text' ? <Hash size={16} className="text-gray-400 mr-2"/> :
                 type === 'voice' ? <Volume2 size={16} className="text-gray-400 mr-2"/> :
                 <Globe size={16} className="text-gray-400 mr-2"/>}
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  placeholder="neuer-kanal"
                  className="w-full bg-transparent text-white py-2.5 outline-none font-medium no-drag"
                />
             </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
             <div>
               <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Standard Passwort</label>
               <input
                 type="text"
                 value={defaultPassword}
                 onChange={(e) => setDefaultPassword(e.target.value)}
                 className="w-full bg-dark-400 border border-dark-500 rounded-xl text-white px-3 py-2 focus:border-primary outline-none"
                 placeholder="Optional"
               />
             </div>
             <div>
               <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Beitritts Passwort</label>
               <input
                 type="text"
                 value={joinPassword}
                 onChange={(e) => setJoinPassword(e.target.value)}
                 className="w-full bg-dark-400 border border-dark-500 rounded-xl text-white px-3 py-2 focus:border-primary outline-none"
                 placeholder="Optional"
               />
             </div>
           </div>

           {/* Footer */}
           <div className="flex justify-end items-center pt-2">
               <button type="button" onClick={onClose} className="text-white hover:underline text-sm font-medium px-6">Abbrechen</button>
               <button 
                 type="submit"
                 disabled={loading || !name}
                 className="bg-primary hover:bg-indigo-500 text-white px-6 py-2 rounded font-medium disabled:opacity-50 flex items-center gap-2"
               >
                 {loading && <Loader2 className="animate-spin" size={16} />}
                 Kanal erstellen
               </button>
           </div>
        </form>
      </div>
    </div>
  );
};