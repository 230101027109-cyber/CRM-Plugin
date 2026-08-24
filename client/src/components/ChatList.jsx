import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { contactsAPI, channelsAPI, conversationsAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import moment from 'moment';
import { Search, Plus, X } from 'lucide-react';

const ChatList = ({ onSelectChat, activeChat }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateConversation, setShowCreateConversation] = useState(false);
  const [channels, setChannels] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
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

  const loadCreateConversationOptions = useCallback(async () => {
    try {
      const [channelsRes, contactsRes] = await Promise.all([
        channelsAPI.getAll(),
        contactsAPI.getContacts(),
      ]);
      const connected = (channelsRes.data?.data || []).filter(ch => ch.status === 'connected');
      setChannels(connected);
      setContacts(contactsRes.data?.data || []);
      if (connected.length > 0) setSelectedChannelId(connected[0].channelId);
      if ((contactsRes.data?.data || []).length > 0) setSelectedContactId((contactsRes.data.data[0].jid));
    } catch (error) {
      console.error('Error loading conversation options:', error);
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

  // Merge real-time socket unread counts into the chats
  const enrichedChats = useMemo(() => {
    if (!newMessages || Object.keys(newMessages).length === 0) return chats;
    return chats.map(chat => {
      const conversationKey = chat.conversationKey || `${chat.channelId || 'no-channel'}::${chat.jid}`;
      const socketMsgs = newMessages[conversationKey] || newMessages[chat.jid];
      if (!socketMsgs) return chat;
      const unreadFromSocket = socketMsgs.filter(m => !m.fromMe && !m.read).length;
      // Take the higher of API unread count and socket unread count
      const mergedUnread = Math.max(chat.unreadCount || 0, unreadFromSocket);
      // Use socket's latest message if it's newer
      const latestSocket = socketMsgs[socketMsgs.length - 1];
      const mergedLastMessage = latestSocket && new Date(latestSocket.timestamp) > new Date(chat.lastMessageTime || 0)
        ? latestSocket.content
        : chat.lastMessage;
      const mergedLastTime = latestSocket && new Date(latestSocket.timestamp) > new Date(chat.lastMessageTime || 0)
        ? latestSocket.timestamp
        : chat.lastMessageTime;
      return { ...chat, unreadCount: mergedUnread, lastMessage: mergedLastMessage, lastMessageTime: mergedLastTime };
    });
  }, [chats, newMessages]);

  // Filter by search
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return enrichedChats;
    const q = searchQuery.toLowerCase();
    return enrichedChats.filter(c =>
      (c.name || c.phone || '').toLowerCase().includes(q) ||
      (c.lastMessage || '').toLowerCase().includes(q)
    );
  }, [enrichedChats, searchQuery]);

  const startConversation = async () => {
    const contact = contacts.find(c => c.jid === selectedContactId);
    if (!contact) return;
    const selectedChannel = channels.find(ch => ch.channelId === selectedChannelId);
    if (!selectedChannel) return;

    try {
      const res = await conversationsAPI.open({
        channelId: selectedChannel.channelId,
        contactId: contact._id,
        jid: contact.jid,
        name: contact.name || contact.pushName || contact.phone,
        phone: contact.phone,
      });

      const conversation = res.data?.data || {
        conversationId: null,
        channelId: selectedChannel.channelId,
      };

      onSelectChat({
        ...contact,
        conversationId: conversation.conversationId,
        channelId: selectedChannel.channelId,
        conversationKey: `${selectedChannel.channelId}::${contact.jid}`,
        name: contact.name || contact.pushName || contact.phone,
      });
      setShowCreateConversation(false);
    } catch (error) {
      console.error('Error creating conversation:', error);
      alert('Could not open this conversation.');
    }
  };

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
        <nav className="flex gap-1 mb-3">
          <button className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md font-medium">Chats</button>
          <button onClick={() => navigate('/contacts')} className="px-3 py-1 text-sm bg-white text-gray-600 rounded-md hover:bg-gray-100">Contacts</button>
          <button onClick={() => navigate('/groups')} className="px-3 py-1 text-sm bg-white text-gray-600 rounded-md hover:bg-gray-100">Groups</button>
        </nav>
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-green-500"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              loadCreateConversationOptions();
              setShowCreateConversation(true);
            }}
            className="inline-flex items-center justify-center rounded-lg bg-green-600 px-2.5 py-2 text-white hover:bg-green-700 transition-colors"
            title="Create conversation"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto chat-scroll">
        {loading ? (
          <div className="p-4 text-center text-gray-400">Loading chats...</div>
        ) : filteredChats.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            {searchQuery ? 'No chats match your search' : 'No chats yet'}
          </div>
        ) : (
          filteredChats.map(chat => (
            <div
              key={chat.jid}
              onClick={() => onSelectChat(chat)}
              className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 ${activeChat?.jid === chat.jid ? 'bg-green-50' : ''}`}
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                {(chat.name || chat.phone || '?').charAt(0).toUpperCase()}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <p className="font-medium text-gray-900 truncate text-sm">{chat.name || chat.phone}</p>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                    {chat.lastMessageTime ? moment(chat.lastMessageTime).format('HH:mm') : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <p className="text-sm text-gray-500 truncate">
                    {chat.isGroup ? (chat.lastMessage || 'No messages') : (chat.lastMessage || 'No messages')}
                  </p>
                  {chat.unreadCount > 0 && (
                    <span className="ml-2 bg-green-500 text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 flex-shrink-0">
                      {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="font-semibold text-gray-900">Create conversation</h2>
              <button type="button" onClick={() => setShowCreateConversation(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Select channel</label>
                <select
                  value={selectedChannelId}
                  onChange={e => setSelectedChannelId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                >
                  {channels.map(channel => (
                    <option key={channel.channelId} value={channel.channelId}>{channel.channelName || channel.channelId}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Select contact</label>
                <select
                  value={selectedContactId}
                  onChange={e => setSelectedContactId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                >
                  {contacts.map(contact => (
                    <option key={contact.jid} value={contact.jid}>{contact.name || contact.pushName || contact.phone}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <button type="button" onClick={() => setShowCreateConversation(false)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button type="button" onClick={startConversation} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">Open conversation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatList;
