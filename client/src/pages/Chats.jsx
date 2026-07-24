import React, { useState } from 'react';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';

const Chats = () => {
  const [activeChat, setActiveChat] = useState(null);

  return (
    <div className="flex h-full bg-white">
      <ChatList
        onSelectChat={setActiveChat}
        activeChat={activeChat}
      />
      <div className="flex-1 flex flex-col min-w-0 border-l border-gray-200">
        <ChatWindow chat={activeChat} onBack={() => setActiveChat(null)} />
      </div>
    </div>
  );
};

export default Chats;
