import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Hash, Bell, Pin, Users, Search, Plus, Gift, Sticker, Smile, Send, Loader2 } from 'lucide-react';
import { getServerUrl } from '../../utils/apiConfig';
import { useSocket } from '../../context/SocketContext';

// Typen für Nachrichten
interface Message {
  id: number;
  content: string;
  createdAt: string;
  sender: {
    id: number;
    username: string;
    avatar_url?: string;
  };
}

interface ChatChannelViewProps {
  channelId: number;
  channelName: string;
}

export const ChatChannelView = ({ channelId, channelName }: ChatChannelViewProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Refs für Auto-Scroll und Socket
  const scrollRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket();

  // 1. Nachrichten laden (History) & Socket Room beitreten
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('clover_token');
        const res = await axios.get(`${getServerUrl()}/api/channels/${channelId}/messages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessages(res.data);
      } catch (err) {
        console.error("Fehler beim Laden der Nachrichten:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Dem Socket-Raum beitreten
    if (socket) {
      socket.emit('join_channel', channelId);
    }

  }, [channelId, socket]);

  // 2. Auf neue Nachrichten hören (Realtime)
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMessage: Message) => {
      // Prüfen ob Nachricht für diesen Channel ist (Sicherheitshalber)
      // (Hier vereinfacht, da wir eh nur Messages für diesen Raum empfangen sollten)
      setMessages((prev) => [...prev, newMessage]);
    };

    socket.on('receive_message', handleNewMessage);

    return () => {
      socket.off('receive_message', handleNewMessage);
    };
  }, [socket, channelId]);

  // 3. Auto-Scroll nach unten bei neuen Nachrichten
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 4. Nachricht senden
  const sendMessage = async () => {
    if (!inputText.trim() || !socket) return;

    const user = JSON.parse(localStorage.getItem('clover_user') || '{}');
    
    // An Socket Server senden
    socket.emit('send_message', {
      content: inputText,
      channelId: channelId,
      userId: user.id
    });

    setInputText(''); // Input leeren
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Helper für Zeitformatierung
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col bg-dark-100 relative z-0 h-full">
      
      {/* Header */}
      <div className="h-12 border-b border-dark-400 flex items-center px-4 shadow-sm bg-dark-100 flex-shrink-0">
        <Hash className="text-gray-400 mr-2" size={20} />
        <span className="font-bold text-white mr-4">{channelName}</span>
        
        {/* Header Icons */}
        <div className="ml-auto flex items-center gap-4 text-gray-400">
            <Bell size={20} className="hover:text-gray-200 cursor-pointer" />
            <Pin size={20} className="hover:text-gray-200 cursor-pointer" />
            <Users size={20} className="hover:text-gray-200 cursor-pointer" />
            <div className="relative hidden md:block">
                <input type="text" placeholder="Suchen" className="bg-dark-400 text-sm px-2 py-1 rounded w-32 transition-all focus:w-48 outline-none text-white" />
                <Search size={14} className="absolute right-2 top-1.5" />
            </div>
        </div>
      </div>
      
      {/* Nachrichten Bereich */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar flex flex-col">
         
         {/* Welcome Banner (scrollt weg wenn viele Nachrichten da sind) */}
         {!loading && messages.length < 10 && (
           <div className="mt-auto mb-8">
              <div className="w-16 h-16 bg-dark-300 rounded-full flex items-center justify-center mb-4">
                  <Hash size={40} className="text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">Willkommen in #{channelName}!</h1>
              <p className="text-gray-400">Das ist der Anfang des Kanals.</p>
           </div>
         )}

         {loading && (
           <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-primary" /></div>
         )}

         {/* Messages List */}
         {messages.map((msg) => (
            <div key={msg.id} className="group flex gap-4 hover:bg-dark-200/30 p-1 -mx-2 rounded pr-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="w-10 h-10 rounded-full bg-dark-300 flex-shrink-0 mt-0.5 overflow-hidden">
                    {msg.sender.avatar_url ? (
                      <img src={msg.sender.avatar_url} alt={msg.sender.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-indigo-500 text-white font-bold">
                        {msg.sender.username.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 align-baseline">
                        <span className="text-white font-medium hover:underline cursor-pointer">{msg.sender.username}</span>
                        <span className="text-xs text-gray-400 ml-1">{formatTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-gray-300 text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                        {msg.content}
                    </p>
                </div>
            </div>
         ))}
      </div>

      {/* Input Bereich */}
      <div className="px-4 pb-6 pt-2 flex-shrink-0">
          <div className="bg-dark-300 rounded-lg p-2.5 flex items-center gap-3 relative focus-within:ring-1 focus-within:ring-primary/50 transition-all">
              <button className="bg-gray-400/20 text-gray-400 hover:text-white p-1 rounded-full transition-colors">
                  <Plus size={16} />
              </button>

              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Nachricht an #${channelName}`} 
                className="bg-transparent flex-1 outline-none text-white text-sm placeholder-gray-500 h-full py-1 no-drag" 
              />

              <div className="flex gap-3 text-gray-400 items-center">
                  <Gift size={20} className="hover:text-white cursor-pointer" />
                  <Sticker size={20} className="hover:text-white cursor-pointer" />
                  <Smile size={20} className="hover:text-white cursor-pointer" />
                  {/* Send Button wenn Text da ist */}
                  {inputText.length > 0 && (
                     <button onClick={sendMessage} className="text-primary hover:text-white transition-colors">
                        <Send size={20} />
                     </button>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};