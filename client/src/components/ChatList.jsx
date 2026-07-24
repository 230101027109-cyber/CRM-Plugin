import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { contactsAPI } from '../services/api';
import { whatsappAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import moment from 'moment';

const ChatList = ({ onSelectChat, activeChat }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isConnected, newMessages } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchChats = useCallback(async () => {
    try {
      const res = await contactsAPI.getChatList();
      if (res.data.success) setChats(res.data.data);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchChats();
    const interval = setInterval(fetchChats, 15000);
    return () => clearInterval(interval);
  }, [user, navigate, fetchChats]);

  const getUnreadCount = useCallback((jid) => {
    if (!newMessages || !newMessages[jid]) return 0;
    return newMessages[jid].filter(m => !m.read && !m.fromMe).length;
  }, [newMessages]);

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold text-gray-800">WhatsApp CRM</h1>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-xs text-gray-500">{isConnected ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        <nav className="flex gap-1">
          <button className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md font-medium">Chats</button>
          <button onClick={() => navigate('/contacts')} className="px-3 py-1 text-sm bg-white text-gray-600 rounded-md hover:bg-gray-100">Contacts</button>
          <button onClick={() => navigate('/groups')} className="px-3 py-1 text-sm bg-white text-gray-600 rounded-md hover:bg-gray-100">Groups</button>
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto chat-scroll">
        {loading ? (
          <div className="p-4 text-center text-gray-400">Loading chats...</div>
        ) : chats.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">No chats yet</div>
        ) : (
          chats.map(chat => (
            <div
              key={chat.jid}
              onClick={() => onSelectChat(chat)}
              className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 ${activeChat?.jid === chat.jid ? 'bg-green-50' : ''}`}
            >
              <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium flex-shrink-0">
                {chat.name ? chat.name.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <p className="font-medium text-gray-900 truncate">{chat.name || chat.phone}</p>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {chat.lastMessageTime ? moment(chat.lastMessageTime).format('HH:mm') : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-sm text-gray-500 truncate">{chat.lastMessage || 'No messages'}</p>
                  {chat.unreadCount > 0 && (
                    <span className="ml-2 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                      {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatList;
