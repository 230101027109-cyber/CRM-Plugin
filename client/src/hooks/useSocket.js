import { io } from 'socket.io-client';
import { useContext, createContext, useEffect, useState, useCallback } from 'react';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
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
    if (!token) return;

    const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket connected');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('qr_code', (qr) => {
      setQrCode(qr);
    });

    newSocket.on('new_message', ({ remoteJid, message }) => {
      setNewMessages(prev => ({
        ...prev,
        [remoteJid]: [...(prev[remoteJid] || []), message],
      }));
    });

    newSocket.on('contacts_updated', (updates) => {
      console.log('Contacts updated:', updates);
    });

    newSocket.on('messages_marked_read', ({ jid }) => {
      setNewMessages(prev => {
        const updated = { ...prev };
        if (updated[jid]) {
          updated[jid] = updated[jid].map(m => ({ ...m, read: true }));
        }
        return updated;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const joinChat = useCallback((jid) => {
    socket?.emit('join_chat', jid);
  }, [socket]);

  const leaveChat = useCallback((jid) => {
    socket?.emit('leave_chat', jid);
  }, [socket]);

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      newMessages,
      qrCode,
      whatsappStatus,
      setWhatsappStatus,
      joinChat,
      leaveChat,
    }}>
      {children}
    </SocketContext.Provider>
  );
};
