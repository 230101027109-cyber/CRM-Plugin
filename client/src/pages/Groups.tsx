import React, { useState } from 'react';
import GroupList from '../components/GroupList';
import ChatWindow from '../components/ChatWindow';

const Groups = () => {
  const [selectedGroup, setSelectedGroup] = useState(null);

  return (
    <div className="flex h-full bg-white">
      <GroupList onSelectGroup={setSelectedGroup} />
      <div className="flex-1 flex flex-col min-w-0 border-l border-gray-200">
        <ChatWindow chat={selectedGroup} onBack={() => setSelectedGroup(null)} />
      </div>
    </div>
  );
};

export default Groups;
