import { useEffect, useState, useRef } from 'react';
import { Globe, RefreshCw, Copy, ExternalLink, Play } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { useTopBar } from '../window/TopBarContext';
import { useChatStore } from '../../store/useChatStore';

interface WebChannelViewProps {
  channelId: number;
  channelName: string;
}

// Standard-URL für Codenames
const DEFAULT_URL = 'https://codenames.game/';

export const WebChannelView = ({ channelId, channelName }: WebChannelViewProps) => {
  const { setSlots, clearSlots } = useTopBar();
  const { updateChannelContent } = useChatStore();
  
  const [currentUrl, setCurrentUrl] = useState(DEFAULT_URL);
  const [inputUrl, setInputUrl] = useState(DEFAULT_URL);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<number>(Date.now());

  // Intervall zum Prüfen auf neue URLs (Polling), damit alle synchron bleiben
  useEffect(() => {
    let isMounted = true;
    
    const fetchContent = async () => {
      try {
        const data = await apiFetch<{ content?: string }>(`/api/channels/${channelId}/content`);
        if (isMounted && data?.content && data.content.startsWith('http')) {
          // Nur aktualisieren, wenn sich die URL wirklich geändert hat
          setCurrentUrl((prev) => {
            if (prev !== data.content) {
              setInputUrl(data.content!); // Input auch updaten
              return data.content!;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Fehler beim Laden des Kanal-Status', err);
      }
    };

    // Sofort laden
    fetchContent();

    // Alle 3 Sekunden prüfen (einfacher Sync ohne komplexe Sockets)
    const interval = setInterval(fetchContent, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [channelId]);

  // Funktion: URL synchronisieren
  const handleSync = async () => {
    if (!inputUrl) return;
    setIsLoading(true);
    try {
      await updateChannelContent(channelId, inputUrl);
      setCurrentUrl(inputUrl);
      setLastSynced(Date.now());
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // UI für die TopBar (Desktop)
  const desktopControls = (
    <div className="no-drag flex items-center gap-2 bg-dark-200 rounded p-1 border border-dark-400">
      <input
        type="text"
        value={inputUrl}
        onChange={(e) => setInputUrl(e.target.value)}
        placeholder="https://codenames.game/room/..."
        className="bg-dark-300 text-gray-200 text-xs px-2 py-1.5 rounded border border-dark-400 w-64 focus:border-blue-500 outline-none font-mono"
      />
      <button
        onClick={handleSync}
        disabled={isLoading}
        className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded transition disabled:opacity-50"
      >
        {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        Sync
      </button>
    </div>
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ct?.windowControls) {
      setSlots({ right: desktopControls });
    }
    return () => clearSlots();
  }, [desktopControls, setSlots, clearSlots]);

  return (
    <div className="flex flex-col h-full bg-dark-100 relative overflow-hidden">
      
      {/* Mobile/In-App Header (falls nicht Desktop-Mode) */}
      {!(typeof window !== 'undefined' && window.ct?.windowControls) && (
        <div className="h-14 border-b border-dark-400 flex items-center px-4 justify-between bg-dark-200 shrink-0">
          <div className="flex items-center gap-3">
            <Globe className="text-blue-400" size={20} />
            <span className="font-bold text-gray-100">{channelName}</span>
          </div>
          
          <div className="flex items-center gap-2">
             <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="bg-dark-300 text-gray-200 text-xs px-2 py-1.5 rounded border border-dark-400 w-40 md:w-64 focus:border-blue-500 outline-none"
            />
            <button
              onClick={handleSync}
              className="bg-green-700 hover:bg-green-600 text-white p-1.5 rounded"
              title="URL für alle synchronisieren"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content: Iframe */}
      <div className="flex-1 relative w-full h-full">
        <iframe
          key={lastSynced} // Erzwingt Neuladen bei Sync
          src={currentUrl}
          title="Game Embed"
          className="w-full h-full border-none bg-white"
          allow="autoplay; encrypted-media; microphone; camera; fullscreen; clipboard-read; clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-presentation allow-downloads"
        />
        
        {/* Overlay Info beim Start */}
        {currentUrl === DEFAULT_URL && (
          <div className="absolute bottom-6 right-6 max-w-sm bg-dark-200/95 backdrop-blur border border-yellow-500/30 p-4 rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 fade-in">
            <div className="flex items-start gap-3">
              <div className="bg-yellow-500/20 p-2 rounded-lg text-yellow-500">
                <Play size={20} />
              </div>
              <div>
                <h4 className="font-bold text-gray-100 mb-1">Spiel starten</h4>
                <p className="text-xs text-gray-300 leading-relaxed mb-3">
                  Erstelle im Fenster einen Raum. Kopiere dann den Link (z.B. aus dem Menü) und füge ihn oben in die Leiste ein. Klicke auf <strong>Sync</strong>, damit alle Freunde automatisch beitreten!
                </p>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setInputUrl('https://codenames.game/room/')} 
                        className="text-[10px] bg-dark-300 hover:bg-dark-400 px-2 py-1 rounded border border-dark-400 text-gray-400"
                    >
                        Link einfügen...
                    </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};