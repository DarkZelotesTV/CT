import { useCallback, useMemo, useState } from 'react';
import { apiFetch } from '../api/http';

export interface ChatMessage {
  id: string;
  authorId: string;
  content: string;
  createdAt: number;
}

export interface ChatStore {
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'createdAt'>) => void;
  clear: () => void;
  updateChannelContent: (channelId: number, content: string) => Promise<void>;
}

export const useChatStore = (): ChatStore => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'createdAt'>) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        ...message,
      },
    ]);
  }, []);

  const clear = useCallback(() => setMessages([]), []);

  const updateChannelContent = useCallback(async (channelId: number, content: string) => {
    await apiFetch(`/api/channels/${channelId}/content`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }, []);

  return useMemo(
    () => ({
      messages,
      addMessage,
      clear,
      updateChannelContent
    }),
    [messages, addMessage, clear, updateChannelContent],
  );
};