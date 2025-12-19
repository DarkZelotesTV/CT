import { useCallback, useMemo, useState } from 'react';

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

  return useMemo(
    () => ({
      messages,
      addMessage,
      clear,
    }),
    [messages, addMessage, clear],
  );
};
