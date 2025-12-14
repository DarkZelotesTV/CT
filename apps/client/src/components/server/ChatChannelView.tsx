import { useEffect, useState, useRef } from 'react';
import { Hash, Bell, Pin, Users, Search, Plus, Gift, Sticker, Smile, Send, Loader2 } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { useSocket } from '../../context/SocketContext';

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

  const scrollRef = useRef<HTMLDivElement>(null);
  const { socket, channelPresence } = useSocket();
  const activeUsers = channelPresence[channelId] || [];

  // --- API LOGIC: Nachrichten Laden ---
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      setMessages([]); // Reset bei Channel-Wechsel
      try {
        const res = await apiFetch<Message[]>(`/api/channels/${channelId}/messages`);
        setMessages(res);
      } catch (err) {
        console.error("Chat Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    if (socket) socket.emit('join_channel', channelId);

  }, [channelId, socket]);

  // --- SOCKET LOGIC: Neue Nachricht ---
  useEffect(() => {
    if (!socket) return;
    const handleMsg = (newMsg: Message) => {
        // Optional: Check if msg.channel_id === channelId
        setMessages((prev) => [...prev, newMsg]);
    };
    socket.on('receive_message', handleMsg);
    return () => { socket.off('receive_message', handleMsg); };
  }, [socket, channelId]);

  // Auto-Scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || !socket) return;
    const user = JSON.parse(localStorage.getItem('clover_user') || '{}');
    socket.emit('send_message', { content: inputText, channelId, userId: user.id });
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-row h-full bg-transparent relative">
      <div className="flex-1 flex flex-col h-full bg-transparent relative">

        {/* HEADER */}
        <div className="h-12 border-b border-white/5 flex items-center px-4 bg-white/[0.02] backdrop-blur-md flex-shrink-0 justify-between">
          <div className="flex items-center text-white">
             <Hash className="text-gray-500 mr-2" size={20} />
             <span className="font-bold tracking-tight">{channelName}</span>
          </div>

          <div className="flex items-center gap-4 text-gray-400">
              <Bell size={18} className="hover:text-white cursor-pointer transition-colors" />
              <Pin size={18} className="hover:text-white cursor-pointer transition-colors" />
              <Users size={18} className="hover:text-white cursor-pointer transition-colors block lg:hidden" />
              <div className="relative hidden md:block">
                  <input type="text" placeholder="Suchen" className="bg-black/20 text-xs px-2 py-1.5 rounded w-32 focus:w-48 outline-none text-white transition-all border border-transparent focus:border-white/10" />
                  <Search size={12} className="absolute right-2 top-2 text-gray-500" />
              </div>
          </div>
        </div>

        {/* MESSAGES AREA */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
           {loading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>}

           {!loading && messages.length === 0 && (
              <div className="mt-10 px-4">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                      <Hash size={32} className="text-white/50" />
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">Willkommen in #{channelName}!</h1>
                  <p className="text-gray-400">Dies ist der Beginn deiner Legende.</p>
              </div>
           )}

           {messages.map((msg, i) => {
               const isSameSender = i > 0 && messages[i-1].sender.id === msg.sender.id;
               return (
                  <div key={msg.id} className={`group flex gap-4 hover:bg-white/[0.02] px-2 py-0.5 -mx-2 rounded transition-colors ${!isSameSender ? 'mt-4' : ''}`}>
                      {!isSameSender ? (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex-shrink-0 overflow-hidden cursor-pointer shadow-lg hover:scale-105 transition-transform mt-0.5">
                              {msg.sender.avatar_url ? (
                                  <img src={msg.sender.avatar_url} className="w-full h-full object-cover" />
                              ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
                                      {msg.sender.username[0].toUpperCase()}
                                  </div>
                              )}
                          </div>
                      ) : (
                          <div className="w-10 flex-shrink-0 text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 text-right pt-1 select-none">
                              {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                      )}

                      <div className="flex-1 min-w-0">
                          {!isSameSender && (
                              <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-white font-medium hover:underline cursor-pointer">{msg.sender.username}</span>
                                  <span className="text-[10px] text-gray-500">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              </div>
                          )}
                          <p className={`text-gray-300 text-[15px] leading-relaxed whitespace-pre-wrap ${!isSameSender ? '' : ''}`}>
                              {msg.content}
                          </p>
                      </div>
                  </div>
               );
           })}
        </div>

        {/* INPUT AREA */}
        <div className="px-4 pb-6 pt-2 flex-shrink-0">
            <div className="bg-white/5 rounded-xl p-2 flex items-center gap-2 relative focus-within:bg-white/10 transition-colors shadow-inner ring-1 ring-white/5 focus-within:ring-primary/50">
                <button className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors">
                    <Plus size={20} />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Nachricht an #${channelName}`}
                  className="bg-transparent flex-1 outline-none text-white text-sm placeholder-gray-500 h-full py-2 no-drag"
                />

                <div className="flex gap-1 text-gray-400 pr-1">
                    <button className="p-1.5 hover:text-white hover:bg-white/10 rounded-md transition-all"><Gift size={20}/></button>
                    <button className="p-1.5 hover:text-white hover:bg-white/10 rounded-md transition-all"><Sticker size={20}/></button>
                    <button className="p-1.5 hover:text-white hover:bg-white/10 rounded-md transition-all"><Smile size={20}/></button>
                    {inputText.length > 0 && (
                       <button onClick={sendMessage} className="p-1.5 text-primary hover:bg-primary/20 rounded-md transition-all animate-in zoom-in">
                          <Send size={20} />
                       </button>
                    )}
                </div>
            </div>
        </div>
      </div>

      <aside className="w-64 border-l border-white/5 bg-white/[0.02] backdrop-blur-md hidden xl:flex flex-col">
        <div className="h-12 flex items-center px-4 border-b border-white/5 flex-shrink-0 justify-between">
          <div className="flex items-center gap-2 text-gray-400 uppercase text-[10px] tracking-widest font-bold">
            <Users size={14} />
            Aktive Nutzer
          </div>
          <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{activeUsers.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {activeUsers.length === 0 && (
            <div className="text-xs text-gray-500 px-2">Niemand ist gerade hier.</div>
          )}

          {activeUsers.map((user) => {
            const speaking = user.isSpeaking;
            return (
              <div key={user.id} className={`flex items-center gap-3 p-2 rounded-lg border border-white/5 ${speaking ? 'bg-green-500/10 border-green-500/30' : 'bg-white/[0.04]'}`}>
                <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 overflow-hidden flex items-center justify-center">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-sm">{user.username?.[0]?.toUpperCase()}</span>
                  )}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#09090b] ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white font-medium truncate">{user.username}</div>
                  <div className="text-[11px] text-gray-500 truncate">{speaking ? 'Spricht gerade' : 'Leise'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
};