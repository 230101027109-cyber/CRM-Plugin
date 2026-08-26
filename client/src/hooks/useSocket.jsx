import {
  io,
} from 'socket.io-client';
import {
  useContext,
  createContext,
  useEffect,
  useState,
  useCallback,
} from 'react';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error(
      'useSocket must be used within SocketProvider'
    );
  }

  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [newMessages, setNewMessages] = useState({});
  const [qrCode, setQrCode] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState('disconnected');

  useEffect(() => {
    const token = localStorage.getItem('crm_token');

    if (!token) return undefined;

    const newSocket = io(
      import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
      {
        auth: { token },
        transports: ['websocket', 'polling'],
      }
    );

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('qr_code', (qr) => {
      setQrCode(qr);
    });

    newSocket.on(
      'new_message',
      ({ conversationKey, channelId, remoteJid, message }) => {
        if (!conversationKey) {
          return;
        }

        setNewMessages((previous) => ({
          ...previous,
          [conversationKey]: [
            ...(previous[conversationKey] || []),
            {
              ...message,
              channelId,
              remoteJid,
            },
          ],
        }));
      }
    );

    newSocket.on(
      'messages_marked_read',
      ({ conversationKey }) => {
        if (!conversationKey) return;

        setNewMessages((previous) => {
          const messages = previous[conversationKey];

          if (!messages) {
            return previous;
          }

          return {
            ...previous,
            [conversationKey]: messages.map((message) => ({
              ...message,
              read: true,
            })),
          };
        });
      }
    );

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const joinChat = useCallback(
    (jid, channelId) => {
      if (!socket || !jid || !channelId) return;

      socket.emit('join_chat', {
        jid,
        channelId,
      });
    },
    [socket]
  );

  const leaveChat = useCallback(
    (jid, channelId) => {
      if (!socket || !jid || !channelId) return;

      socket.emit('leave_chat', {
        jid,
        channelId,
      });
    },
    [socket]
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        newMessages,
        qrCode,
        whatsappStatus,
        setWhatsappStatus,
        joinChat,
        leaveChat,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
