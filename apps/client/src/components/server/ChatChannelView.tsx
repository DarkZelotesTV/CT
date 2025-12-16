import { useEffect, useRef, useState } from 'react';
import { Hash, Bell, Pin, Users, Search, Plus, Sticker, Smile, Send, SquareArrowOutUpRight, MoreVertical, Loader2 } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { ChatMessageList } from '../chat/ChatMessageList';
import { ChatAttachment, ChatMessageContent, useChatChannel } from '../../hooks/useChatChannel';

interface ChatChannelViewProps {
  channelId: number;
  channelName: string;
  isCompact?: boolean;
  onOpenMembers?: () => void;
}

export const ChatChannelView = ({ channelId, channelName, isCompact = false, onOpenMembers }: ChatChannelViewProps) => {
  const { channelPresence } = useSocket();
  const { messages, loading, loadingMore, hasMore, loadMore, inputText, setInputText, handleKeyDown, sendMessage } =
    useChatChannel(channelId);
  const activeUsers = channelPresence[channelId] || [];
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [selectedGif, setSelectedGif] = useState<ChatMessageContent['giphy'] | null>(null);
  const [showTray, setShowTray] = useState(false);
  const [giphyResults, setGiphyResults] = useState<{ id: string; url: string; previewUrl?: string }[]>([]);
  const [giphyQuery, setGiphyQuery] = useState('');
  const [giphyLoading, setGiphyLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShowHeaderMenu(false);
  }, [channelId]);

  useEffect(() => {
    const fetchGifs = async (query: string) => {
      setGiphyLoading(true);
      try {
        const endpoint = query.trim()
          ? `https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(query)}&limit=12&rating=pg`
          : `https://api.giphy.com/v1/gifs/trending?api_key=dc6zaTOxFJmzC&limit=12&rating=pg`;
        const res = await fetch(endpoint);
        const data = await res.json();
        const mapped = (data?.data || []).map((gif: any) => ({
          id: gif.id,
          url: gif.images?.original?.url ?? gif.url,
          previewUrl: gif.images?.downsized_medium?.url || gif.images?.downsized?.url,
        }));
        setGiphyResults(mapped);
      } catch (err) {
        console.error('Giphy search failed', err);
        setGiphyResults([]);
      } finally {
        setGiphyLoading(false);
      }
    };

    fetchGifs(giphyQuery);
  }, [giphyQuery]);

  const handlePopout = () => {
    const url = `#/popout/${channelId}?name=${encodeURIComponent(channelName)}`;
    if (window.electron?.openChatWindow) {
      window.electron.openChatWindow(channelId, channelName);
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer,width=480,height=720');
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files) return;
    const maxSize = 10 * 1024 * 1024;
    const promises = Array.from(files).map(
      (file) =>
        new Promise<ChatAttachment | null>((resolve) => {
          if (file.size > maxSize) {
            alert(`${file.name} überschreitet die 10MB-Grenze und wurde nicht angehängt.`);
            return resolve(null);
          }

          const reader = new FileReader();
          reader.onload = () => {
            resolve({ name: file.name, size: file.size, type: file.type, dataUrl: reader.result as string });
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        })
    );

    const prepared = (await Promise.all(promises)).filter(Boolean) as ChatAttachment[];
    if (prepared.length) {
      setAttachments((prev) => [...prev, ...prepared]);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() && attachments.length === 0 && !selectedGif) return;
    const payload: ChatMessageContent = {
      text: inputText.trim(),
      attachments: attachments.length ? attachments : undefined,
      giphy: selectedGif || undefined,
    };
    await sendMessage(payload);
    setAttachments([]);
    setSelectedGif(null);
    setShowTray(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else {
      handleKeyDown(e);
    }
  };

  const handleEmojiInsert = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  return (
    <div className="flex-1 flex flex-row h-full bg-transparent relative">
      <div className="flex-1 flex flex-col h-full bg-transparent relative">

        {/* HEADER */}
        <div className="h-12 border-b border-white/5 flex items-center px-4 bg-white/[0.02] backdrop-blur-md flex-shrink-0 justify-between">
          <div className="flex items-center text-white gap-2 min-w-0">
            <Hash className="text-gray-500" size={20} />
            <span className="font-bold tracking-tight truncate">{channelName}</span>
          </div>

          <div className="relative flex items-center gap-2 text-gray-400">
            <div className="hidden sm:flex items-center gap-3">
              <button
                onClick={handlePopout}
                className="flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <SquareArrowOutUpRight size={14} />
                Im neuen Fenster öffnen
              </button>
              <Bell size={18} className="hover:text-white cursor-pointer transition-colors" />
              <Pin size={18} className="hover:text-white cursor-pointer transition-colors" />
              {onOpenMembers && (
                <button
                  onClick={onOpenMembers}
                  className="hover:text-white cursor-pointer transition-colors block lg:hidden"
                  aria-label="Mitglieder anzeigen"
                >
                  <Users size={18} />
                </button>
              )}
              <div className="relative hidden md:block">
                <input
                  type="text"
                  placeholder="Suchen"
                  className="bg-black/20 text-xs px-2 py-1.5 rounded w-32 focus:w-48 outline-none text-white transition-all border border-transparent focus:border-white/10"
                />
                <Search size={12} className="absolute right-2 top-2 text-gray-500" />
              </div>
            </div>

            <button
              className="sm:hidden p-2 rounded-lg hover:bg-white/10 text-white/80 transition-colors"
              onClick={() => setShowHeaderMenu((open) => !open)}
              aria-label="Weitere Optionen"
            >
              <MoreVertical size={18} />
            </button>

            {showHeaderMenu && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-[#0d0d10]/95 border border-white/10 rounded-xl shadow-2xl p-2 flex flex-col gap-1">
                <button
                  onClick={() => {
                    handlePopout();
                    setShowHeaderMenu(false);
                  }}
                  className="flex items-center gap-2 text-xs font-medium text-gray-200 hover:text-white hover:bg-white/5 rounded-lg px-3 py-2 text-left"
                >
                  <SquareArrowOutUpRight size={14} />
                  Im neuen Fenster öffnen
                </button>
                <button
                  onClick={() => setShowHeaderMenu(false)}
                  className="flex items-center gap-2 text-xs font-medium text-gray-200 hover:text-white hover:bg-white/5 rounded-lg px-3 py-2 text-left"
                >
                  <Bell size={14} />
                  Benachrichtigungen
                </button>
                <button
                  onClick={() => setShowHeaderMenu(false)}
                  className="flex items-center gap-2 text-xs font-medium text-gray-200 hover:text-white hover:bg-white/5 rounded-lg px-3 py-2 text-left"
                >
                  <Pin size={14} />
                  Channel pinnen
                </button>
                {onOpenMembers && (
                  <button
                    onClick={() => {
                      onOpenMembers();
                      setShowHeaderMenu(false);
                    }}
                    className="flex items-center gap-2 text-xs font-medium text-gray-200 hover:text-white hover:bg-white/5 rounded-lg px-3 py-2 text-left"
                  >
                    <Users size={14} />
                    Mitglieder anzeigen
                  </button>
                )}
                <div className="relative mt-1">
                  <input
                    type="text"
                    placeholder="Suchen"
                    className="bg-black/30 text-xs px-3 py-2 rounded w-full outline-none text-white transition-all border border-transparent focus:border-white/10 pr-8"
                  />
                  <Search size={12} className="absolute right-3 top-3 text-gray-500" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MESSAGES AREA */}
        <ChatMessageList
          messages={messages}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={loadMore}
          channelName={channelName}
          isCompact={isCompact}
        />

        {/* INPUT AREA */}
        <div className="px-4 pb-6 pt-2 flex-shrink-0">
          <div className="bg-white/5 rounded-xl p-2 flex items-center gap-2 relative focus-within:bg-white/10 transition-colors shadow-inner ring-1 ring-white/5 focus-within:ring-primary/50 w-full min-w-0">
            <input
              type="file"
              multiple
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            <button
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              title="Datei anhängen"
            >
              <Plus size={20} />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={`Nachricht an #${channelName}`}
              className="bg-transparent flex-1 min-w-0 outline-none text-white text-sm placeholder-gray-500 h-full py-2 no-drag"
            />

            {(attachments.length > 0 || selectedGif) && (
              <div className="absolute left-2 right-2 -top-24 bg-[#0d0d10] border border-white/10 rounded-lg p-2 shadow-xl flex gap-2 overflow-x-auto custom-scrollbar">
                {attachments.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-md border border-white/10"
                  >
                    <span className="text-xs text-gray-200 truncate max-w-[120px]">{file.name}</span>
                    <button
                      className="text-gray-400 hover:text-white"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Anhang entfernen"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {selectedGif && (
                  <div className="relative">
                    <img
                      src={selectedGif.previewUrl || selectedGif.url}
                      className="h-16 w-16 object-cover rounded-md border border-white/10"
                    />
                    <button
                      className="absolute -top-2 -right-2 bg-black/70 text-white rounded-full h-6 w-6 text-xs"
                      onClick={() => setSelectedGif(null)}
                      aria-label="GIF entfernen"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-1 text-gray-400 pr-1 items-center flex-shrink-0">
              <div className="relative">
                <button
                  className="p-1.5 hover:text-white hover:bg-white/10 rounded-md transition-all"
                  onClick={() => {
                    setShowTray((open) => !open);
                  }}
                  title="Sticker und Emojis"
                >
                  <Sticker size={20} />
                </button>
                <button
                  className="p-1.5 hover:text-white hover:bg-white/10 rounded-md transition-all"
                  onClick={() => {
                    setShowTray((open) => !open);
                  }}
                  title="Emoji-Auswahl"
                >
                  <Smile size={20} />
                </button>
                <button
                  className="p-1.5 hover:text-white hover:bg-white/10 rounded-md transition-all font-black text-[10px] uppercase"
                  onClick={() => setShowTray((open) => !open)}
                  title="Giphy suchen"
                >
                  GIF
                </button>

                {showTray && (
                  <div className="absolute right-0 bottom-12 w-[520px] max-w-[90vw] bg-[#0d0d10] border border-white/10 rounded-xl shadow-2xl p-3 flex gap-4 z-20">
                    <div className="w-32">
                      <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Emojis</div>
                      <div className="grid grid-cols-4 gap-2 text-lg">
                        {['😀', '😂', '😍', '🤔', '🙌', '🔥', '🎉', '😎'].map((emoji) => (
                          <button
                            key={emoji}
                            className="hover:bg-white/10 rounded-lg"
                            onClick={() => handleEmojiInsert(emoji)}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Search size={14} className="text-gray-500" />
                        <input
                          value={giphyQuery}
                          onChange={(e) => setGiphyQuery(e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50"
                          placeholder="Giphy durchsuchen"
                        />
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                        {giphyLoading && (
                          <div className="col-span-full flex justify-center py-6 text-gray-400">
                            <Loader2 className="animate-spin mr-2" size={16} /> Suche Gifs...
                          </div>
                        )}
                        {!giphyLoading &&
                          giphyResults.map((gif) => (
                            <button
                              key={gif.id}
                              className="relative group rounded-lg overflow-hidden border border-white/5 hover:border-primary/60 focus:outline-none focus:border-primary"
                              onClick={() => {
                                setSelectedGif(gif);
                                setShowTray(false);
                              }}
                            >
                              <img src={gif.previewUrl || gif.url} className="object-cover w-full h-24" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        {!giphyLoading && giphyResults.length === 0 && (
                          <div className="col-span-full text-center text-gray-500 text-sm py-4">Keine GIFs gefunden.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {inputText.length > 0 || attachments.length > 0 || selectedGif ? (
                <button onClick={handleSend} className="p-1.5 text-primary hover:bg-primary/20 rounded-md transition-all animate-in zoom-in">
                  <Send size={20} />
                </button>
              ) : null}
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