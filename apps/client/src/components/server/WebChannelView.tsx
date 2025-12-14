import { useState, useEffect } from 'react';
import { Globe, Edit, Save, X } from 'lucide-react';
import { apiFetch } from '../../api/http';

interface WebChannelViewProps {
  channelId: number;
  channelName: string;
}

export const WebChannelView = ({ channelId, channelName }: WebChannelViewProps) => {
  const [htmlContent, setHtmlContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ content?: string }>(`/api/channels/${channelId}/content`);
        const content = data?.content ?? '';
        setHtmlContent(content);
        setEditValue(content);
        setIsEditing(false);
      } catch (err: any) {
        setError(err?.message || 'Fehler beim Laden des Inhalts');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [channelId]);

  useEffect(() => {
    if (isEditing) {
      setHtmlContent(editValue);
    }
  }, [editValue, isEditing]);

  // Speichern
  const handleSave = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ content?: string }>(
        `/api/channels/${channelId}/content`,
        { method: 'PUT', body: JSON.stringify({ content: editValue }) }
      );
      const content = data?.content ?? editValue;
      setHtmlContent(content);
      setEditValue(content);
      setIsEditing(false);
    } catch (err) {
      const message = (err as any)?.message || 'Fehler beim Speichern';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-dark-100 relative z-0 h-full overflow-hidden">

      {/* Header */}
      <div className="h-12 border-b border-dark-400 flex items-center px-4 shadow-sm bg-dark-100 flex-shrink-0 justify-between">
        <div className="flex items-center">
          <Globe className="text-gray-400 mr-2" size={20} />
          <span className="font-bold text-white mr-4">{channelName}</span>
        </div>

        {/* Edit Button (Nur für Admins sichtbar machen später) */}
        <button
          onClick={() => {
            if (!isEditing) setEditValue(htmlContent || '<h1>Willkommen!</h1><p>Bearbeite mich...</p>');
            setIsEditing(!isEditing);
          }}
          className="text-gray-400 hover:text-white flex items-center gap-2 text-xs uppercase font-bold"
        >
          {isEditing ? <X size={16}/> : <Edit size={16}/>}
          {isEditing ? 'Abbrechen' : 'Seite bearbeiten'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 text-red-100 text-sm px-4 py-2 border-b border-red-800">
          {error}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">

        {isEditing ? (
          <div className="flex flex-col h-full p-4">
            <textarea
              className="flex-1 bg-dark-300 text-gray-200 font-mono p-4 rounded outline-none border border-dark-400 resize-none text-sm"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              spellCheck={false}
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-6 py-2 rounded flex items-center gap-2 font-bold"
                disabled={loading}
              >
                <Save size={18} /> Speichern
              </button>
            </div>
          </div>
        ) : (
          /* HTML RENDERER */
          <div
            className="p-8 prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: htmlContent || '<div class="text-center text-gray-500 mt-20"><h1>Willkommen</h1><p>Diese Seite ist noch leer.</p></div>' }}
          />
        )}

      </div>
    </div>
  );
};