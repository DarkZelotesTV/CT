import { useState } from 'react';
import { createPortal } from 'react-dom'; // WICHTIG: Import für das Portal
import axios from 'axios';
import { X, Loader2, Upload } from 'lucide-react';
import { getServerUrl } from '../../utils/apiConfig';

interface CreateServerModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export const CreateServerModal = ({ onClose, onCreated }: CreateServerModalProps) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('clover_token');
      await axios.post(
        `${getServerUrl()}/api/servers`, 
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Fehler beim Erstellen des Servers");
    } finally {
      setLoading(false);
    }
  };

  // Wir nutzen createPortal(JSX, document.body), damit das Fenster 
  // aus der kleinen Sidebar "ausbricht" und mittig auf dem Bildschirm landet.
  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center animate-in fade-in duration-200 p-4">
      
      {/* Klick auf Hintergrund schließt das Modal */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Modal Card */}
      <div className="bg-[#111214] w-full max-w-md rounded-2xl shadow-2xl border border-white/10 overflow-hidden transform transition-all scale-100 relative z-10">
        
        {/* Header */}
        <div className="p-6 text-center relative">
           <button 
             onClick={onClose}
             className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
           >
             <X size={20} />
           </button>
           <h2 className="text-2xl font-bold text-white tracking-tight">Neuer Server</h2>
           <p className="text-gray-400 mt-2 text-sm">
             Erschaffe einen neuen Ort für deine Community.
           </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-6">
           
           {/* Icon Upload Placeholder */}
           <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-gray-400 hover:border-indigo-500 hover:text-indigo-400 cursor-pointer transition-all group">
                  <Upload size={24} className="group-hover:scale-110 transition-transform mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Icon</span>
              </div>
           </div>

           {/* Input */}
           <div className="space-y-2">
             <label className="text-xs font-bold text-gray-400 uppercase ml-1">Server Name</label>
             <input 
               autoFocus
               type="text" 
               value={name}
               onChange={(e) => setName(e.target.value)}
               placeholder="Mein epischer Server"
               className="w-full bg-black/30 text-white p-3 rounded-xl border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-600 font-medium"
             />
           </div>

           <button 
             type="submit"
             disabled={loading || !name.trim()}
             className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
           >
             {loading ? <Loader2 className="animate-spin" size={18} /> : 'Server erstellen'}
           </button>
        </form>

        {/* Footer Hint */}
        <div className="bg-white/[0.02] p-3 text-center border-t border-white/5">
           <p className="text-[11px] text-gray-500">
              Durch das Erstellen stimmst du den <span className="text-indigo-400 cursor-pointer hover:underline">Community Guidelines</span> zu.
           </p>
        </div>

      </div>
    </div>,
    document.body // Das Ziel des Portals
  );
};