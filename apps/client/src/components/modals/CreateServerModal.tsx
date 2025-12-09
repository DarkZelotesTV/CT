import { useState } from 'react';
import axios from 'axios';
import { X, Loader2, Upload } from 'lucide-react';
import { getServerUrl } from '../../utils/apiConfig';

interface CreateServerModalProps {
  onClose: () => void;
  onCreated: () => void; // Sagt der Eltern-Komponente: "Lad die Liste neu!"
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
      
      // POST Anfrage an dein Backend
      await axios.post(
        `${getServerUrl()}/api/servers`, 
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      onCreated(); // Liste aktualisieren
      onClose();   // Fenster schließen
    } catch (err) {
      console.error(err);
      alert("Fehler beim Erstellen des Servers");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Overlay (Dunkler Hintergrund)
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
      
      {/* Modal Card */}
      <div className="bg-dark-200 w-full max-w-md rounded-lg shadow-2xl border border-dark-400 overflow-hidden transform transition-all scale-100">
        
        {/* Header */}
        <div className="p-6 text-center relative">
           <button 
             onClick={onClose}
             className="absolute top-4 right-4 text-gray-400 hover:text-white"
           >
             <X size={24} />
           </button>
           <h2 className="text-2xl font-bold text-white">Erstelle deinen Server</h2>
           <p className="text-gray-400 mt-2 text-sm">
             Dein neuer Raum für Talks und Chats. Gib ihm einen Namen.
           </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 pt-0 space-y-4">
           
           {/* Upload Placeholder (Nur Optik für MVP) */}
           <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-500 flex flex-col items-center justify-center text-gray-500 hover:border-white hover:text-white cursor-pointer transition-colors">
                  <Upload size={20} />
                  <span className="text-[10px] mt-1 font-bold uppercase">Icon</span>
              </div>
           </div>

           {/* Input */}
           <div>
             <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Server Name</label>
             <input 
               autoFocus
               type="text" 
               value={name}
               onChange={(e) => setName(e.target.value)}
               placeholder="Mein cooler Server"
               className="w-full bg-dark-400 text-white p-2.5 rounded border-none focus:ring-2 focus:ring-primary outline-none"
             />
           </div>
        </form>

        {/* Footer */}
        <div className="bg-dark-300 p-4 flex justify-between items-center">
           <button 
             onClick={onClose}
             className="text-white hover:underline text-sm font-medium px-4"
           >
             Zurück
           </button>
           <button 
             onClick={handleSubmit}
             disabled={loading || !name.trim()}
             className="bg-primary hover:bg-indigo-500 text-white px-6 py-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
           >
             {loading && <Loader2 className="animate-spin" size={16} />}
             Erstellen
           </button>
        </div>

      </div>
    </div>
  );
};