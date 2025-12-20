import { useCallback, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useSettings } from '../context/SettingsContext';

type NotificationType = 'mention' | 'direct_message' | 'server_invite';

type NotificationTarget = {
  serverId?: number;
  channelId?: number;
  channelName?: string;
  channelType?: 'text' | 'voice' | 'web' | 'data-transfer' | 'list' | 'spacer';
};

export type NotificationEventPayload = {
  title?: string;
  body: string;
  icon?: string;
  target?: NotificationTarget;
};

const isNotificationSupported = () => typeof window !== 'undefined' && typeof Notification !== 'undefined';

export const useDesktopNotifications = (onNavigate: (target: NotificationTarget) => void) => {
  const { socket } = useSocket();
  const { settings, updateNotifications } = useSettings();

  const requestPermission = useCallback(async () => {
    if (!isNotificationSupported()) {
      updateNotifications({ permission: 'unsupported' });
      return 'unsupported' as const;
    }
    const result = await Notification.requestPermission();
    updateNotifications({ permission: result });
    return result;
  }, [updateNotifications]);

  useEffect(() => {
    if (!isNotificationSupported()) {
      updateNotifications({ permission: 'unsupported' });
      return;
    }

    if (settings.notifications.permission !== Notification.permission) {
      updateNotifications({ permission: Notification.permission });
    }

    if (settings.notifications.permission === 'default') {
      void requestPermission();
    }
  }, [requestPermission, settings.notifications.permission, updateNotifications]);

  const shouldNotify = useCallback(
    (type: NotificationType) => {
      if (type === 'mention') return settings.notifications.mentions;
      if (type === 'direct_message') return settings.notifications.directMessages;
      if (type === 'server_invite') return settings.notifications.invites;
      return false;
    },
    [settings.notifications.directMessages, settings.notifications.invites, settings.notifications.mentions]
  );

  const triggerNotification = useCallback(
    async (type: NotificationType, payload: NotificationEventPayload) => {
      if (!shouldNotify(type)) return;

      const permission = settings.notifications.permission;
      if (permission === 'unsupported') return;

      if (permission !== 'granted') {
        const result = await requestPermission();
        if (result !== 'granted') return;
      }

      if (!isNotificationSupported() || Notification.permission !== 'granted') return;

      const title =
        payload.title ||
        (type === 'mention'
          ? 'Neue Erwähnung'
          : type === 'direct_message'
            ? 'Neue Direktnachricht'
            : 'Server-Einladung');

      const notification = new Notification(title, {
        body: payload.body,
        icon: payload.icon,
        silent: false,
      });

      notification.onclick = () => {
        window.focus();
        if (payload.target) onNavigate(payload.target);
        notification.close();
      };
    },
    [onNavigate, requestPermission, settings.notifications.permission, shouldNotify]
  );

  useEffect(() => {
    if (!socket) return;

    const handleMention = (payload: NotificationEventPayload) => triggerNotification('mention', payload);
    const handleDirectMessage = (payload: NotificationEventPayload) => triggerNotification('direct_message', payload);
    const handleInvite = (payload: NotificationEventPayload) => triggerNotification('server_invite', payload);

    socket.on('mention', handleMention);
    socket.on('direct_message', handleDirectMessage);
    socket.on('server_invite', handleInvite);

    return () => {
      socket.off('mention', handleMention);
      socket.off('direct_message', handleDirectMessage);
      socket.off('server_invite', handleInvite);
    };
  }, [socket, triggerNotification]);
};
