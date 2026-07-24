import React, { useState, useEffect } from 'react';
import { contactsAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import WhatsAppConnection from '../components/WhatsAppConnection';
import axios from 'axios';

const Chats = () => {
  const [activeChat, setActiveChat] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [qrCode, setQrCode] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const { isConnected, joinChat, leaveChat, setWhatsappStatus } = useSocket();

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const res = await contactsAPI.getChatList();
      if (res.data?.success) {
        setConnectionStatus('connected');
        setWhatsappStatus('connected');
      }
    } catch (error) {
      setConnectionStatus('disconnected');
    }
  };

  const handleConnect = async () => {
    try {
      setQrCode('Generating QR code...');
      await axios.post('/api/whatsapp/connect');
      setTimeout(() => checkStatus(), 3000);
    } catch (error) {
      console.error('Error connecting:', error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await axios.post('/api/whatsapp/sync');
      setTimeout(() => checkStatus(), 2000);
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex h-screen justify-center bg-gray-100">
      <div className="flex w-full max-w-7xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden my-2 md:my-4">
        {showSidebar && (
          <ChatList
            onSelectChat={setActiveChat}
            activeChat={activeChat}
          />
        )}
        <div className="flex-1 flex flex-col">
          <div className="bg-gray-50 p-3 border-b">
            <WhatsAppConnection
              status={connectionStatus}
              onConnect={handleConnect}
              qrCode={qrCode}
              syncing={syncing}
              onSync={handleSync}
            />
          </div>
          <ChatWindow chat={activeChat} onBack={() => setActiveChat(null)} />
        </div>
      </div>
    </div>
  );
};

export default Chats;
