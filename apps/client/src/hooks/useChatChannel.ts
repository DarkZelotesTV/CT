import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api/http';
import { useSocket } from '../context/SocketContext';

export interface ChatMessage {
  id: number;
  content: string;
  createdAt: string;
  channel_id?: number;
  channelId?: number;
  sender: {
    id: number;
    username: string;
    avatar_url?: string;
  };
}

interface UseChatChannelResult {
  messages: ChatMessage[];
  loading: boolean;
  inputText: string;
  setInputText: (value: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  sendMessage: () => Promise<void>;
}

export const useChatChannel = (channelId: number | null): UseChatChannelResult => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    if (channelId === null) return;
    const fetchMessages = async () => {
      setLoading(true);
      setMessages([]);
      try {
        const res = await apiFetch<ChatMessage[]>(`/api/channels/${channelId}/messages`);
        setMessages(res);
      } catch (err) {
        console.error('Chat Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [channelId]);

  useEffect(() => {
    if (!socket || channelId === null) return;

    socket.emit('join_channel', channelId);

    return () => {
      socket.emit('leave_channel', channelId);
    };
  }, [socket, channelId]);

  useEffect(() => {
    if (!socket || channelId === null) return;

    const handleMsg = (newMsg: ChatMessage) => {
      const msgChannelId = (newMsg.channel_id ?? newMsg.channelId) as number | undefined;
      if (msgChannelId !== undefined && msgChannelId !== channelId) return;

      setMessages((prev) => [...prev, newMsg]);
    };

    socket.on('receive_message', handleMsg);
    return () => {
      socket.off('receive_message', handleMsg);
    };
  }, [socket, channelId]);

  const sendMessage = async () => {
    if (!inputText.trim() || !socket || channelId === null) return;
    const user = JSON.parse(localStorage.getItem('clover_user') || '{}');
    socket.emit('send_message', { content: inputText, channelId, userId: user.id });
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return { messages, loading, inputText, setInputText, handleKeyDown, sendMessage };
};
