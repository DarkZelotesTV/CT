import { useState } from 'react';
import { X, Loader2, Compass } from 'lucide-react';
import { apiFetch } from '../../api/http';

interface JoinServerModalProps {
  onClose: () => void;
  onJoined: () => void;
}

export const JoinServerModal = ({ onClose, onJoined }: JoinServerModalProps) => {
  const [inviteCode, setInviteCode] = useState(''); // Hier kommt die Server ID rein
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Wir nutzen die ID als Invite Code für das MVP
      await apiFetch('/api/servers/join', {
        method: 'POST',
        body: JSON.stringify({ serverId: inviteCode })
      });
      
      onJoined();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Server nicht gefunden oder ungültige ID");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-dark-200 w-full max-w-md rounded-lg shadow-2xl border border-dark-400 overflow-hidden">
        
        {/* Header */}
        <div className="p-6 text-center relative">
           <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={24} /></button>
           <h2 className="text-2xl font-bold text-white">Server beitreten</h2>
           <p className="text-gray-400 mt-2 text-sm">
             Gib unten die Server-ID oder den Einladungs-Link ein.
           </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 pt-0 space-y-4">
           
           <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-dark-300 flex items-center justify-center text-green-500">
                  <Compass size={40} />
              </div>
           </div>

           {error && <div className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded">{error}</div>}

           <div>
             <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Invite Code / Server ID</label>
             <input 
               autoFocus
               type="text" 
               value={inviteCode}
               onChange={(e) => setInviteCode(e.target.value)}
               placeholder="z.B. 1"
               className="w-full bg-dark-400 text-white p-2.5 rounded border-none focus:ring-2 focus:ring-green-500 outline-none"
             />
             <p className="text-[10px] text-gray-500 mt-1">Für dieses MVP: Gib einfach die ID des Servers ein (z.B. '1', '2').</p>
           </div>
        </form>

        {/* Footer */}
        <div className="bg-dark-300 p-4 flex justify-between items-center">
           <button onClick={onClose} className="text-white hover:underline text-sm font-medium px-4">Abbrechen</button>
           <button 
             onClick={handleSubmit}
             disabled={loading || !inviteCode}
             className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-medium disabled:opacity-50 flex items-center gap-2"
           >
             {loading && <Loader2 className="animate-spin" size={16} />}
             Beitreten
           </button>
        </div>
      </div>
    </div>
  );
};