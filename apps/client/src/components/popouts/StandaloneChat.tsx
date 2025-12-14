import { Send, LogIn } from 'lucide-react'; // 'LogIn' Icon sieht aus wie "Reingehen"
import { useParams, useSearchParams } from 'react-router-dom';

export const StandaloneChat = () => {
  const { chatId } = useParams();
  const [searchParams] = useSearchParams();
  const chatName = searchParams.get('name') || 'Chat';

  const handleDock = () => {
    if (chatId && window.electron?.dockChatWindow) {
      // Sende Signal an Electron
      window.electron.dockChatWindow(chatId, chatName);
    }
  };

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
          {/* Icon das "Wieder rein" symbolisiert */}
          <LogIn size={18} />
        </button>
      </div>

      {/* ... Rest der Chat Logik (Messages, Input) ... */}
      <div className="flex-1 p-4 overflow-y-auto bg-dark-100 space-y-4">
         <div className="text-center text-gray-500 text-xs">Chat ID: {chatId}</div>
         <p className="text-gray-300">Ich bin ein separates Fenster.</p>
      </div>

      <div className="p-4 bg-dark-200 border-t border-dark-400">
        <div className="flex items-center bg-dark-300 rounded-lg px-3 py-2">
            <input className="no-drag bg-transparent border-none outline-none text-white text-sm flex-1" placeholder="..." />
            <button className="no-drag text-gray-400 hover:text-primary p-1"><Send size={18} /></button>
        </div>
      </div>
    </div>
  );
};