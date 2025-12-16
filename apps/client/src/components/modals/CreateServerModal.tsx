import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { ModalLayout } from './ModalLayout';

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
      await apiFetch('/api/servers', {
        method: 'POST',
        body: JSON.stringify({ name })
      });
      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Fehler beim Erstellen des Servers");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalLayout
      title="Neuer Server"
      description="Erschaffe einen neuen Ort für deine Community."
      onClose={onClose}
      footer={
        <p className="text-[11px] text-gray-500">
          Durch das Erstellen stimmst du den <span className="text-indigo-400 cursor-pointer hover:underline">Community Guidelines</span> zu.
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-gray-400 hover:border-indigo-500 hover:text-indigo-400 cursor-pointer transition-all group">
            <Upload size={24} className="group-hover:scale-110 transition-transform mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Icon</span>
          </div>
        </div>

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
    </ModalLayout>
  );
};