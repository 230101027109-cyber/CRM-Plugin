import React, { useState } from 'react';
import ContactList from '../components/ContactList';
import ChatWindow from '../components/ChatWindow';
import WhatsAppConnection from '../components/WhatsAppConnection';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Contacts = () => {
  const [selectedContact, setSelectedContact] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [syncing, setSyncing] = useState(false);
  const navigate = useNavigate();

  const handleConnect = async () => {
    try {
      await axios.post('/api/whatsapp/connect');
      setTimeout(checkStatus, 3000);
    } catch (error) {
      console.error('Error connecting:', error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await axios.post('/api/whatsapp/sync');
      setTimeout(checkStatus, 2000);
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const checkStatus = async () => {
    try {
      await axios.get('/api/contacts/contacts');
      setConnectionStatus('connected');
    } catch {
      setConnectionStatus('disconnected');
    }
  };

  return (
    <div className="flex h-screen justify-center bg-gray-100">
      <div className="flex w-full max-w-7xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden my-2 md:my-4">
        <div className="flex-1 flex flex-col">
          <div className="bg-gray-50 p-3 border-b">
            <WhatsAppConnection
              status={connectionStatus}
              onConnect={handleConnect}
              syncing={syncing}
              onSync={handleSync}
            />
          </div>
          <div className="flex-1 flex overflow-hidden">
            <ContactList onSelectContact={setSelectedContact} />
            <ChatWindow chat={selectedContact} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contacts;
