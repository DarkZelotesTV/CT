import { Send, LogIn } from 'lucide-react'; // 'LogIn' Icon sieht aus wie "Reingehen"
import { useParams, useSearchParams } from 'react-router-dom';
import { ChatMessageList } from '../chat/ChatMessageList';
import { useChatChannel } from '../../hooks/useChatChannel';

export const StandaloneChat = () => {
  const { chatId } = useParams();
  const [searchParams] = useSearchParams();
  const chatName = searchParams.get('name') || 'Chat';
  const channelId = chatId ? Number(chatId) : null;

  const { messages, loading, loadingMore, hasMore, loadMore, inputText, setInputText, handleKeyDown, sendMessage } =
    useChatChannel(channelId);

  const handleDock = () => {
    if (!channelId) return;

    if (window.electron?.dockChatWindow) {
      window.electron.dockChatWindow(channelId, chatName);
    }

    if (typeof BroadcastChannel !== 'undefined') {
      const broadcast = new BroadcastChannel('ct-chat-docking');
      broadcast.postMessage({ type: 'chat:docked', chatId: channelId, chatName });
      broadcast.close();
    }
  };

  if (!channelId) {
    return (
      <div className="flex flex-col h-screen bg-dark-100 text-white font-sans items-center justify-center">
        <p className="text-gray-400">Ungültige Channel-ID.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-dark-100 text-white font-sans">
      {/* Header */}
      <div className="bg-dark-200 p-3 flex items-center justify-between border-b border-dark-400 shadow-sm drag-region">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="font-bold truncate">{chatName}</span>
        </div>

        {/* Dock Button */}
        <button
          onClick={handleDock}
          className="no-drag text-gray-400 hover:text-white p-1 hover:bg-dark-300 rounded transition-colors"
          title="Zurück ins Hauptfenster andocken"
        >
          <LogIn size={18} />
        </button>
      </div>

      {/* Messages */}
      <ChatMessageList
        messages={messages}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
        channelName={chatName}
      />

      <div className="p-4 bg-dark-200 border-t border-dark-400">
        <div className="flex items-center bg-dark-300 rounded-lg px-3 py-2">
          <input
            className="no-drag bg-transparent border-none outline-none text-white text-sm flex-1"
            placeholder={`Nachricht an #${chatName}`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="no-drag text-gray-400 hover:text-primary p-1" onClick={sendMessage}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};