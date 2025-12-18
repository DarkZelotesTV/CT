import { useEffect, useRef } from 'react';
import { Loader2, GripVertical } from 'lucide-react';
import { ChatMessage, ChatMessageContent } from '../../hooks/useChatChannel';

interface ChatMessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  channelName: string;
  isCompact?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  isListMode?: boolean;
  draggingId?: number | null;
  onDragStart?: (id: number) => void;
  onDragEnd?: () => void;
  onReorder?: (fromId: number, toId: number) => void;
}

export const ChatMessageList = ({
  messages,
  loading,
  channelName,
  isCompact = false,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  isListMode = false,
  draggingId = null,
  onDragStart,
  onDragEnd,
  onReorder,
}: ChatMessageListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevHeightRef = useRef(0);
  const prevFirstIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const previousHeight = prevHeightRef.current;
      const previousFirstId = prevFirstIdRef.current;
      const isPrepend = previousFirstId !== null && messages[0]?.id !== previousFirstId;

      if (isPrepend) {
        const currentScroll = el.scrollTop;
        el.scrollTop = el.scrollHeight - previousHeight + currentScroll;
      } else {
        el.scrollTop = el.scrollHeight;
      }

      prevHeightRef.current = el.scrollHeight;
      prevFirstIdRef.current = messages[0]?.id ?? null;
    }
  }, [messages]);

  const handleScroll = () => {
    if (!scrollRef.current || !onLoadMore || !hasMore || loadingMore) return;
    if (scrollRef.current.scrollTop < 120) {
      onLoadMore();
    }
  };

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1 custom-scrollbar"
      onScroll={handleScroll}
    >
      {loadingMore && (
        <div className="flex justify-center py-2 text-gray-400 text-xs">
          <Loader2 className="animate-spin mr-2" size={14} /> Ältere Nachrichten werden geladen...
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-primary" />
        </div>
      )}

      {!loading && messages.length === 0 && (
        <div className="mt-10 px-4">
          <div className="relative mb-6">
            <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent blur-2xl" />
            <div className="relative p-6 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-md shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                  #
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.25em] text-indigo-200/80">Neuer Channel</div>
                  <div className="text-xl font-bold text-white">#{channelName}</div>
                </div>
              </div>
              <p className="text-gray-400 leading-relaxed text-sm">
                Starte die Unterhaltung mit deiner Crew! Nutze <span className="text-indigo-200">/commands</span> oder lade Freunde ein, um gemeinsam zu chatten.
              </p>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Willkommen in #{channelName}!</h1>
          <p className="text-gray-400">Dies ist der Beginn deiner Legende.</p>
        </div>
      )}

      {messages.map((msg, i) => {
        const isSameSender = i > 0 && messages[i - 1].sender.id === msg.sender.id;
        const isRichContent = (content: ChatMessage['content']): content is ChatMessageContent =>
          typeof content === 'object' && content !== null;

        const rich = isRichContent(msg.content) ? msg.content : null;
        const textContent = rich ? rich.text ?? '' : (msg.content as string);
        const attachments = rich?.attachments || [];
        const giphy = rich?.giphy;
        return (
          <div
            key={msg.id}
            className={`group flex gap-3 sm:gap-4 items-start hover:bg-white/[0.02] px-2 py-0.5 -mx-2 rounded transition-colors ${
              !isSameSender ? 'mt-4' : ''
            } ${isCompact ? 'flex-wrap' : 'flex-wrap sm:flex-nowrap'} ${
              isListMode && draggingId === msg.id ? 'border border-primary/40 bg-primary/5' : ''
            }`}
            draggable={isListMode}
            onDragStart={() => onDragStart?.(msg.id)}
            onDragOver={isListMode ? (e) => e.preventDefault() : undefined}
            onDrop={
              isListMode
                ? (e) => {
                    e.preventDefault();
                    if (draggingId !== null && draggingId !== msg.id) {
                      onReorder?.(draggingId, msg.id);
                    }
                    onDragEnd?.();
                  }
                : undefined
            }
            onDragEnd={isListMode ? onDragEnd : undefined}
          >
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
              <div className="w-10 min-w-[2.5rem] flex-shrink-0 text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 text-right pt-1 select-none">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}

            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              {!isSameSender && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 mb-0.5">
                  <span className="text-white font-medium hover:underline cursor-pointer">{msg.sender.username}</span>
                  <span className="text-[10px] text-gray-500">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {isListMode && (
                <div className="flex items-center gap-2 text-[10px] uppercase text-gray-500">
                  <GripVertical size={12} />
                  Manuell sortierter Eintrag
                </div>
              )}
              {textContent && (
                <p className="text-gray-300 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                  {textContent}
                </p>
              )}

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {attachments.map((file, idx) => (
                    <a
                      key={`${file.name}-${idx}`}
                      href={file.dataUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group/att rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden hover:border-primary/60 transition-colors"
                    >
                      {file.type.startsWith('image/') ? (
                        <img
                          src={file.dataUrl}
                          alt={file.name}
                          className="max-h-32 max-w-xs object-cover block"
                        />
                      ) : (
                        <div className="px-3 py-2 text-xs text-gray-200 flex items-center gap-2">
                          <span className="truncate max-w-[12rem]">{file.name}</span>
                          <span className="text-[10px] text-gray-500">{Math.round(file.size / 1024)} KB</span>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              )}

              {giphy?.url && (
                <div className="mt-2">
                  <img
                    src={giphy.previewUrl || giphy.url}
                    alt="GIF"
                    className="max-h-48 rounded-lg border border-white/10 shadow-lg"
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
