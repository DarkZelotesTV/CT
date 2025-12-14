import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';

interface BottomChatBarProps {
  channelId: number | null;
  channelName?: string;
}

const QUICK_REPLIES = ['👋', '👍', 'On it!'];

export const BottomChatBar = ({ channelId, channelName }: BottomChatBarProps) => {
  const { socket } = useSocket();
  const [text, setText] = useState('');

  useEffect(() => {
    setText('');
  }, [channelId]);

  if (!channelId || !channelName) return null;

  const sendMessage = (content: string) => {
    if (!content.trim() || !socket) return;
    const user = JSON.parse(localStorage.getItem('clover_user') || '{}');
    socket.emit('send_message', { content, channelId, userId: user.id });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(text);
    setText('');
  };

  return (
    <div className="absolute bottom-4 right-4 z-40 bg-black/60 border border-white/10 rounded-2xl backdrop-blur-md shadow-xl w-80 p-3 hidden xl:block">
      <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-2">Quick Reply · #{channelName}</div>

      <div className="flex gap-2 mb-3">
        {QUICK_REPLIES.map((reply) => (
          <button
            key={reply}
            onClick={() => sendMessage(reply)}
            className="px-3 py-1 text-xs rounded-full bg-white/5 text-gray-200 hover:bg-white/10 transition-colors"
          >
            {reply}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Nachricht an #${channelName}`}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button
          type="submit"
          className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
          title="Senden"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
