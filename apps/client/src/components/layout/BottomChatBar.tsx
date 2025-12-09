import { X, Minus, Send, ExternalLink } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

// Typ-Definition für unsere Chat-Fenster
interface ChatWindowData {
  id: number;
  name: string;
  x: number;       // X-Position in Pixeln
  zIndex: number;  // Für "Vordergrund" Logik
  minimized: boolean;
}

export const BottomChatBar = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State für die Fenster
  const [chats, setChats] = useState<ChatWindowData[]>([
    { id: 1, name: "Anna", x: 20, zIndex: 1, minimized: false },
    { id: 2, name: "Ben", x: 320, zIndex: 2, minimized: false },
    { id: 3, name: "Gruppe: Raid", x: 620, zIndex: 1, minimized: false }
  ]);

  // State für das Dragging
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // --- DOCKING LISTENER (Wenn ein Fenster zurückkommt) ---
  useEffect(() => {
    // Diese Funktion wird aufgerufen, wenn Electron "chat-docked-back" sendet
    // (Also wenn man im Popout-Fenster auf "Andocken" klickt)
    if (window.electron && window.electron.onChatDocked) {
        window.electron.onChatDocked((chatId, chatName) => {
        
        setChats((prevChats) => {
            // Prüfen, ob der Chat schon da ist
            const exists = prevChats.find(c => c.id === Number(chatId));
            if (exists) return prevChats;

            // Höchsten zIndex finden, damit das neue Fenster vorne ist
            const maxZ = Math.max(...prevChats.map(c => c.zIndex), 0);

            // Neuen Chat hinzufügen
            return [...prevChats, {
            id: Number(chatId),
            name: chatName,
            x: 50, // Standard Position (könnte man noch smarter machen)
            zIndex: maxZ + 1,
            minimized: false
            }];
        });
        });
    }
  }, []);


  // --- ACTIONS ---

  const closeChat = (id: number) => {
    setChats(chats.filter(c => c.id !== id));
  };

  const toggleMinimize = (id: number) => {
    setChats(chats.map(c => c.id === id ? { ...c, minimized: !c.minimized } : c));
  };

  const bringToFront = (id: number) => {
    const maxZ = Math.max(...chats.map(c => c.zIndex), 0);
    setChats(chats.map(c => c.id === id ? { ...c, zIndex: maxZ + 1 } : c));
  };

  // --- DRAG LOGIK ---

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
        const windowWidth = 288; // Breite eines Fensters (w-72 = 18rem = 288px)
        
        // Neue Position berechnen
        let newX = e.clientX - dragOffset;

        // Clamping (Verhindern, dass Fenster rausgeschoben werden)
        if (newX < 0) newX = 0;
        if (newX > containerWidth - windowWidth) newX = containerWidth - windowWidth;

        setChats(prev => prev.map(c => c.id === draggingId ? { ...c, x: newX } : c));
      }
    };

    const handleMouseUp = () => {
      setDraggingId(null);
    };

    // Global Listener hinzufügen, damit man beim schnellen Ziehen nicht den Fokus verliert
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
    // Container ist ABSOLUT im Main-Screen positioniert
    // pointer-events-none lässt Klicks durch auf den Hintergrund (Stage),
    // pointer-events-auto auf den Fenstern reaktiviert Klicks.
    <div ref={containerRef} className="absolute inset-x-0 bottom-0 h-0 pointer-events-none z-30">
       
       {chats.map(chat => (
          <div
            key={chat.id}
            className={`absolute bottom-0 flex flex-col pointer-events-auto transition-shadow shadow-2xl rounded-t-lg border border-dark-400 overflow-hidden ${chat.minimized ? 'h-10' : 'h-96'}`}
            style={{ 
              left: chat.x, 
              zIndex: chat.zIndex,
              width: '288px', // Entspricht w-72
              backgroundColor: '#2b2d31' // Entspricht bg-dark-200
            }}
            onMouseDown={() => bringToFront(chat.id)}
          >
            {/* HEADER */}
            <div 
              className="bg-dark-100 p-2 flex justify-between items-center cursor-move select-none border-b border-dark-400 active:bg-dark-300"
              onMouseDown={(e) => handleMouseDown(e, chat.id, chat.x)}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0"></div>
                <span className="font-bold text-white text-sm truncate">{chat.name}</span>
              </div>
              
              <div className="flex items-center gap-1">
                
                {/* POP-OUT BUTTON */}
                <button 
                  onClick={(e) => { 
                      e.stopPropagation(); 
                      // Öffnet neues Fenster via Electron
                      if(window.electron && window.electron.openChatWindow) {
                          window.electron.openChatWindow(chat.id, chat.name);
                          // Schließt Chat in der Leiste, da er jetzt "draußen" ist
                          closeChat(chat.id); 
                      } else {
                          console.warn("Electron Bridge nicht verfügbar");
                      }
                  }}
                  className="p-1 hover:bg-dark-300 rounded text-gray-400 hover:text-primary transition-colors"
                  title="In eigenem Fenster öffnen"
                >
                  <ExternalLink size={14} />
                </button>

                {/* MINIMIZE BUTTON */}
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleMinimize(chat.id); }}
                  className="p-1 hover:bg-dark-300 rounded text-gray-400"
                >
                  <Minus size={14} />
                </button>
                
                {/* CLOSE BUTTON */}
                <button 
                  onClick={(e) => { e.stopPropagation(); closeChat(chat.id); }}
                  className="p-1 hover:bg-red-500 hover:text-white rounded text-gray-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* CONTENT (Nur sichtbar wenn nicht minimiert) */}
            {!chat.minimized && (
              <>
                <div className="flex-1 bg-dark-200 p-3 overflow-y-auto space-y-2 cursor-default scrollbar-thin scrollbar-thumb-dark-400">
                  <div className="text-xs text-gray-500 text-center my-2">Heute 14:02</div>
                  <div className="bg-dark-300 p-2 rounded-lg rounded-tl-none text-sm text-gray-300 max-w-[90%] self-start">
                    Hey, bist du später beim Meeting dabei?
                  </div>
                  <div className="bg-primary p-2 rounded-lg rounded-tr-none text-sm text-white max-w-[90%] ml-auto">
                    Jo, ich komme in 5 Minuten!
                  </div>
                </div>

                {/* INPUT */}
                <div className="p-2 bg-dark-300 border-t border-dark-400 cursor-default">
                  <div className="flex items-center bg-dark-400 rounded px-2 py-1.5 focus-within:ring-1 focus-within:ring-primary">
                    <input 
                      className="bg-transparent border-none outline-none text-white text-sm flex-1 placeholder-gray-500" 
                      placeholder={`Nachricht an ${chat.name}...`} 
                    />
                    <button className="text-gray-400 hover:text-primary p-1"><Send size={14} /></button>
                  </div>
                </div>
              </>
            )}
          </div>
       ))}
    </div>
  );
};