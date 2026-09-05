import { io, Socket } from 'socket.io-client';
import { useContext, createContext, useEffect, useState, useCallback, ReactNode } from 'react';

interface Message {
  messageId?: string;
  channelId: string;
  remoteJid: string;
  content?: string;
  caption?: string;
  fromMe?: boolean;
  read?: boolean;
  timestamp?: string;
}

interface NewMessagesMap {
  [conversationKey: string]: Message[];
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  newMessages: NewMessagesMap;
  qrCode: string | null;
  whatsappStatus: string;
  setWhatsappStatus: (status: string) => void;
  joinChat: (jid: string, channelId: string) => void;
  leaveChat: (jid: string, channelId: string) => void;
  clearMessagesForConversation: (conversationKey: string) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error(
      'useSocket must be used within SocketProvider'
    );
  }

  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [newMessages, setNewMessages] = useState<NewMessagesMap>({});
  const [qrCode, setQrCode] = useState<string | null>(null);
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

    setIsConnected(newSocket.connected);

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('qr_code', (qr: string) => {
      setQrCode(qr);
    });

    newSocket.on(
      'new_message',
      ({ conversationKey, channelId, remoteJid, message }: { 
        conversationKey: string; 
        channelId: string; 
        remoteJid: string; 
        message: Message;
      }) => {
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
      ({ conversationKey }: { conversationKey: string }) => {
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

  const clearMessagesForConversation = useCallback((conversationKey: string) => {
    setNewMessages((prev) => {
      const next = { ...prev };
      delete next[conversationKey];
      return next;
    });
  }, []);

  const joinChat = useCallback(
    (jid: string, channelId: string) => {
      if (!socket || !jid || !channelId) return;

      socket.emit('join_chat', {
        jid,
        channelId,
      });
    },
    [socket]
  );

  const leaveChat = useCallback(
    (jid: string, channelId: string) => {
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
        clearMessagesForConversation,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
