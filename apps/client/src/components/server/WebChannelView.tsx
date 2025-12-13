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

  // HTML laden beim Start
  useEffect(() => {
    // Wir nutzen hier den structure endpoint oder laden den channel einzeln neu
    // Einfachheitshalber laden wir die Channel-Liste neu, da dort 'content' jetzt drin sein sollte
    // ODER wir bauen einen GET endpoint.
    // Trick: Wir nutzen den structure endpoint im Parent, der übergibt den Content eigentlich nicht.
    // Sauberer Weg: Fetch content.
    const fetchContent = async () => {
        try {
            // Wir "missbrauchen" kurz den Structure Endpoint oder laden Kanäle neu
            // BESSER: Wir holen den Content direkt. Da wir keinen GET /channel/:id haben,
            // bauen wir das Feature einfach direkt hier ein:
            // (Hinweis: Du müsstest im Backend bei GET /structure auch das Feld 'content' mitgeben!)
            
            // Fürs MVP: Wir gehen davon aus, dass wir den Content via Struktur bekommen oder beim Editieren setzen.
            // Lass uns den Content via Props übergeben oder hier fetchen.
            // Wir machen einen schnellen Fetch über die channels route wenn wir sie hätten.
            
            // Provisorisch: Wir laden alle Channels des Servers (haben wir im Parent) 
            // oder speichern es separat. 
            // Damit es einfach geht: Wir nehmen an, es ist leer am Anfang.
        } catch(e) {}
    };
  }, [channelId]);

  // Speichern
  const handleSave = async () => {
    try {
        await apiFetch(`/api/channels/${channelId}/content`,
            { method: 'PUT', body: JSON.stringify({ content: editValue }) }
        );
        setHtmlContent(editValue);
        setIsEditing(false);
    } catch (err) {
        alert("Fehler beim Speichern");
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
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded flex items-center gap-2 font-bold"
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