import React, { useEffect, useRef, useState } from 'react';
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

type ChannelKeyBundle = {
  channelKey: CryptoKey;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicKeyB64: string;
};

const bufferToB64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const b64ToBuffer = (b64: string): ArrayBuffer => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const exportKey = async (key: CryptoKey) => bufferToB64(await crypto.subtle.exportKey('raw', key));

const ensureChannelSymmetricKey = async (channelId: number): Promise<CryptoKey> => {
  const stored = localStorage.getItem(`chat_channel_key_${channelId}`);
  if (stored) {
    return crypto.subtle.importKey('raw', b64ToBuffer(stored), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const exported = await crypto.subtle.exportKey('raw', key);
  localStorage.setItem(`chat_channel_key_${channelId}`, bufferToB64(exported));
  return key;
};

let channelCrypto: ChannelKeyBundle | null = null;

const ensureKeyBundle = async (channelId: number): Promise<ChannelKeyBundle> => {
  if (channelCrypto) return channelCrypto;

  const storedKeyData = localStorage.getItem(`chat_ecdh_${channelId}`);
  let keyPair: CryptoKeyPair;
  if (storedKeyData) {
    const parsed = JSON.parse(storedKeyData);
    keyPair = {
      privateKey: await crypto.subtle.importKey('jwk', parsed.privateKey, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']),
      publicKey: await crypto.subtle.importKey('raw', b64ToBuffer(parsed.publicKey), { name: 'ECDH', namedCurve: 'P-256' }, true, []),
    };
  } else {
    keyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
    const publicKey = await exportKey(keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    localStorage.setItem('chat_ecdh_' + channelId, JSON.stringify({ privateKey, publicKey }));
  }

  const channelKey = await ensureChannelSymmetricKey(channelId);
  const publicKeyB64 = await exportKey(keyPair.publicKey);

  channelCrypto = {
    channelKey,
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicKeyB64,
  };
  return channelCrypto;
};

const encryptWithChannelKey = async (channelKey: CryptoKey, plainText: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, channelKey, encoded);
  return { ciphertext: bufferToB64(cipher), iv: bufferToB64(iv.buffer) };
};

const decryptWithChannelKey = async (channelKey: CryptoKey, ciphertext: string, iv: string): Promise<string> => {
  const decodedCipher = b64ToBuffer(ciphertext);
  const decodedIv = new Uint8Array(b64ToBuffer(iv));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decodedIv }, channelKey, decodedCipher);
  return new TextDecoder().decode(plain);
};

const decryptMessage = async (message: ChatMessage, channelId: number): Promise<ChatMessage> => {
  try {
    const bundle = await ensureKeyBundle(channelId);
    const parsed = JSON.parse(message.content || '{}');
    if (!parsed.ciphertext || !parsed.iv) return message;
    const decryptedContent = await decryptWithChannelKey(bundle.channelKey, parsed.ciphertext, parsed.iv);
    return { ...message, content: decryptedContent };
  } catch (err) {
    console.error('Decrypt error', err);
    return { ...message, content: 'Unable to decrypt message' };
  }
};

const deriveSharedKey = async (privateKey: CryptoKey, peerPublicKeyB64: string) => {
  const peerPublicKey = await crypto.subtle.importKey('raw', b64ToBuffer(peerPublicKeyB64), { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: peerPublicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

const shareChannelKey = async (
  channelId: number,
  targetUserId: number,
  targetPublicKeyB64: string,
  bundle: ChannelKeyBundle,
  socket: ReturnType<typeof useSocket>['socket']
) => {
  if (!socket) return;
  const derivedKey = await deriveSharedKey(bundle.privateKey, targetPublicKeyB64);
  const rawChannelKey = await crypto.subtle.exportKey('raw', bundle.channelKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedKey = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, derivedKey, rawChannelKey);
  const currentUser = JSON.parse(localStorage.getItem('clover_user') || '{}');

  socket.emit('channel_key_share', {
    channelId,
    toUserId: targetUserId,
    fromUserId: currentUser.id,
    encryptedKey: bufferToB64(encryptedKey),
    iv: bufferToB64(iv.buffer),
    senderPublicKey: bundle.publicKeyB64,
  });
};

const receiveChannelKey = async (payload: {
  channelId: number;
  toUserId: number;
  fromUserId: number;
  encryptedKey: string;
  iv: string;
  senderPublicKey: string;
}) => {
  const bundle = await ensureKeyBundle(payload.channelId);
  const derivedKey = await deriveSharedKey(bundle.privateKey, payload.senderPublicKey);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(b64ToBuffer(payload.iv)) },
    derivedKey,
    b64ToBuffer(payload.encryptedKey)
  );

  const newChannelKey = await crypto.subtle.importKey('raw', decrypted, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  channelCrypto = {
    ...bundle,
    channelKey: newChannelKey,
  };
  const exported = await crypto.subtle.exportKey('raw', newChannelKey);
  localStorage.setItem(`chat_channel_key_${payload.channelId}`, bufferToB64(exported));
};

export const useChatChannel = (channelId: number | null): UseChatChannelResult => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const { socket } = useSocket();
  const knownPublicKeys = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    channelCrypto = null;
    knownPublicKeys.current.clear();
  }, [channelId]);

  useEffect(() => {
    if (channelId === null) return;
    const fetchMessages = async () => {
      setLoading(true);
      setMessages([]);
      try {
        const res = await apiFetch<ChatMessage[]>(`/api/channels/${channelId}/messages`);
        const decrypted = await Promise.all(res.map((msg) => decryptMessage(msg, channelId)));
        setMessages(decrypted);
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

    (async () => {
      const bundle = await ensureKeyBundle(channelId);
      socket.emit('join_channel', channelId);
      socket.emit('publish_public_key', { channelId, publicKey: bundle.publicKeyB64 });
    })();

    return () => {
      socket.emit('leave_channel', channelId);
      knownPublicKeys.current.clear();
    };
  }, [socket, channelId]);

  useEffect(() => {
    if (!socket || channelId === null) return;

    const handleMsg = (newMsg: ChatMessage) => {
      const msgChannelId = (newMsg.channel_id ?? newMsg.channelId) as number | undefined;
      if (msgChannelId !== undefined && msgChannelId !== channelId) return;

      decryptMessage(newMsg, channelId)
        .then((decrypted) => {
          setMessages((prev) => [...prev, decrypted]);
        })
        .catch(() => {
          setMessages((prev) => [...prev, { ...newMsg, content: 'Unable to decrypt message' }]);
        });
    };

    const handlePublicKeys = (payload: { channelId: number; keys: { userId: number; publicKey: string }[] }) => {
      if (payload.channelId !== channelId) return;
      payload.keys.forEach(({ userId, publicKey }) => {
        knownPublicKeys.current.set(userId, publicKey);
        ensureKeyBundle(channelId).then((bundle) => shareChannelKey(channelId, userId, publicKey, bundle, socket)).catch(() => undefined);
      });
    };

    const handlePublicKey = (payload: { channelId: number; userId: number; publicKey: string }) => {
      if (payload.channelId !== channelId) return;
      knownPublicKeys.current.set(payload.userId, payload.publicKey);
      ensureKeyBundle(channelId).then((bundle) => shareChannelKey(channelId, payload.userId, payload.publicKey, bundle, socket)).catch(() => undefined);
    };

    const handleKeyShare = async (payload: {
      channelId: number;
      toUserId: number;
      fromUserId: number;
      encryptedKey: string;
      iv: string;
      senderPublicKey: string;
    }) => {
      const currentUser = JSON.parse(localStorage.getItem('clover_user') || '{}');
      if (payload.channelId !== channelId || payload.toUserId !== currentUser.id) return;
      await receiveChannelKey(payload);
    };

    socket.on('receive_message', handleMsg);
    socket.on('channel_public_keys', handlePublicKeys);
    socket.on('channel_public_key', handlePublicKey);
    socket.on('channel_key_share', handleKeyShare);
    return () => {
      socket.off('receive_message', handleMsg);
      socket.off('channel_public_keys', handlePublicKeys);
      socket.off('channel_public_key', handlePublicKey);
      socket.off('channel_key_share', handleKeyShare);
    };
  }, [socket, channelId]);

  const sendMessage = async () => {
    if (!inputText.trim() || !socket || channelId === null) return;
    const user = JSON.parse(localStorage.getItem('clover_user') || '{}');
    const bundle = await ensureKeyBundle(channelId);
    const encrypted = await encryptWithChannelKey(bundle.channelKey, inputText);
    socket.emit('send_message', { content: { ciphertext: encrypted.ciphertext, iv: encrypted.iv }, channelId, userId: user.id });
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

export default useChatChannel;
