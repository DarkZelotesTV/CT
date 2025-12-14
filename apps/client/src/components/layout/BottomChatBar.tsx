import { X, Minus, Send, ExternalLink } from 'lucide-react';
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

// Typen
export interface BottomChatBarRef {
  openChat: (id: number, name: string) => void;
}

interface ChatWindowData {
  id: number;
  name: string;
  x: number;
  zIndex: number;
  minimized: boolean;
}

// Wir nutzen forwardRef, damit MainLayout Funktionen hier aufrufen kann
export const BottomChatBar = forwardRef<BottomChatBarRef, {}>((props, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chats, setChats] = useState<ChatWindowData[]>([
    // Starten wir mal leer oder mit einem Beispiel
    // { id: 999, name: "Willkommen", x: 20, zIndex: 1, minimized: false }
  ]);
  
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // --- SCHNITTSTELLE NACH AUSSEN ---
  useImperativeHandle(ref, () => ({
    openChat: (id: number, name: string) => {
      setChats(prev => {
        // Wenn schon offen, nur maximieren und nach vorne holen
        if (prev.find(c => c.id === id)) {
           return prev.map(c => c.id === id ? { ...c, minimized: false, zIndex: 100 } : c);
        }
        // Sonst neu hinzufügen
        // Wir berechnen eine Position, damit sie sich nicht alle stapeln
        const newX = 20 + (prev.length * 300); 
        return [...prev, { id, name, x: newX, zIndex: 100, minimized: false }];
      });
    }
  }));

  // --- Actions ---
  const closeChat = (id: number) => setChats(chats.filter(c => c.id !== id));

  const popOutChat = (chat: ChatWindowData) => {
    const targetHash = `#/popout/${chat.id}?name=${encodeURIComponent(chat.name)}`;

    if (window.electron?.openChatWindow) {
      window.electron.openChatWindow(chat.id, chat.name);
    } else {
      window.open(targetHash, "_blank", "width=420,height=640");
    }

    closeChat(chat.id);
  };
  
  const toggleMinimize = (id: number) => {
    setChats(chats.map(c => c.id === id ? { ...c, minimized: !c.minimized } : c));
  };

  const bringToFront = (id: number) => {
    const maxZ = Math.max(...chats.map(c => c.zIndex), 0);
    setChats(chats.map(c => c.id === id ? { ...c, zIndex: maxZ + 1 } : c));
  };

  // --- Drag Logik ---
  const handleMouseDown = (e: React.MouseEvent, id: number, currentX: number) => {
    e.stopPropagation();
    bringToFront(id);
    setDraggingId(id);
    setDragOffset(e.clientX - currentX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingId !== null && containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const windowWidth = 288;
        let newX = e.clientX - dragOffset;
        if (newX < 0) newX = 0;
        if (newX > containerWidth - windowWidth) newX = containerWidth - windowWidth;
        setChats(prev => prev.map(c => c.id === draggingId ? { ...c, x: newX } : c));
      }
    };
    const handleMouseUp = () => setDraggingId(null);
    if (draggingId !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, dragOffset]);

  return (
    <div ref={containerRef} className="absolute inset-x-0 bottom-0 h-0 pointer-events-none z-50">
       {chats.map(chat => (
          <div
            key={chat.id}
            className={`absolute bottom-0 flex flex-col pointer-events-auto transition-shadow shadow-2xl rounded-t-lg border border-dark-400 overflow-hidden ${chat.minimized ? 'h-10' : 'h-96'}`}
            style={{ 
              left: chat.x, 
              zIndex: chat.zIndex, 
              width: '288px', 
              backgroundColor: '#2b2d31' 
            }}
            onMouseDown={() => bringToFront(chat.id)}
          >
            {/* Header */}
            <div 
              className="bg-dark-100 p-2 flex justify-between items-center cursor-move select-none border-b border-dark-400 active:bg-dark-300"
              onMouseDown={(e) => handleMouseDown(e, chat.id, chat.x)}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0"></div>
                <span className="font-bold text-white text-sm truncate"># {chat.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); popOutChat(chat); }}
                  className="p-1 hover:bg-dark-300 rounded text-gray-400"
                  title="Chat als Fenster öffnen"
                >
                  <ExternalLink size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleMinimize(chat.id); }}
                  className="p-1 hover:bg-dark-300 rounded text-gray-400"
                >
                  <Minus size={14} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); closeChat(chat.id); }}
                  className="p-1 hover:bg-red-500 hover:text-white rounded text-gray-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Chat Inhalt (Vereinfacht für Layout) */}
            {!chat.minimized && (
              <>
                <div className="flex-1 bg-dark-200 p-3 overflow-y-auto space-y-2 cursor-default scrollbar-thin scrollbar-thumb-dark-400">
                  <div className="text-xs text-gray-500 text-center my-2">Kanal #{chat.name}</div>
                  <div className="bg-dark-300 p-2 rounded-lg rounded-tl-none text-sm text-gray-300 max-w-[90%] self-start">
                    Willkommen im Kanal {chat.name}!
                  </div>
                </div>
                <div className="p-2 bg-dark-300 border-t border-dark-400 cursor-default">
                  <div className="flex items-center bg-dark-400 rounded px-2 py-1.5 focus-within:ring-1 focus-within:ring-primary">
                    <input className="bg-transparent border-none outline-none text-white text-sm flex-1 placeholder-gray-500" placeholder={`Nachricht an #${chat.name}...`} />
                    <button className="text-gray-400 hover:text-primary p-1"><Send size={14} /></button>
                  </div>
                </div>
              </>
            )}
          </div>
       ))}
    </div>
  );
});