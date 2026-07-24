import React, { useState } from 'react';
import ContactList from '../components/ContactList';
import ChatWindow from '../components/ChatWindow';

const Contacts = () => {
  const [selectedContact, setSelectedContact] = useState(null);

  return (
    <div className="flex h-full bg-white">
      <ContactList onSelectContact={setSelectedContact} />
      <div className="flex-1 flex flex-col min-w-0 border-l border-gray-200">
        <ChatWindow chat={selectedContact} onBack={() => setSelectedContact(null)} />
      </div>
    </div>
  );
};

export default Contacts;
