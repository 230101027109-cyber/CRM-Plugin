import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import moment from 'moment';
import axios from 'axios';

const GroupList = ({ onSelectGroup }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroups();
    const interval = setInterval(fetchGroups, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await axios.get('/api/contacts/groups');
      if (res.data.success) setGroups(res.data.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 bg-gray-50 border-b">
        <h1 className="text-xl font-semibold text-gray-800">Groups</h1>
      </div>
      <div className="flex-1 overflow-y-auto chat-scroll">
        {loading ? (
          <div className="p-4 text-center text-gray-400">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">No groups found</div>
        ) : (
          groups.map(group => (
            <div
              key={group.jid}
              onClick={() => onSelectGroup(group)}
              className="flex items-center p-3 cursor-pointer hover:bg-gray-50 border-b"
            >
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium flex-shrink-0">
                <Users size={18} />
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate text-sm">{group.name || group.subject || 'Group'}</p>
                <p className="text-xs text-gray-500">{group.participantCount || 0} participants</p>
              </div>
              {group.lastMessageTime && (
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {moment(group.lastMessageTime).format('HH:mm')}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GroupList;
