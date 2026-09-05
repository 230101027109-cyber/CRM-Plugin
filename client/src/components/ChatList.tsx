import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { contactsAPI, channelsAPI, conversationsAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import moment from 'moment';
import { Search, Plus, X, Trash2 } from 'lucide-react';

const ChatList = ({ onSelectChat, activeChat }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateConversation, setShowCreateConversation] = useState(false);
  const [channels, setChannels] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const { isConnected, newMessages, clearMessagesForConversation } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchChats = useCallback(async () => {
    try {
      const res = await conversationsAPI.getAll();
      if (res.data.success) setChats(res.data.data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
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

      const connected = (channelsRes.data?.data || []).filter(
        (channel) => channel.status === 'connected'
      );
      const allContacts = contactsRes.data?.data || [];

      setChannels(connected);
      setContacts(allContacts);

      const firstChannel = connected[0];
      setSelectedChannelId(firstChannel?.channelId || '');

      const firstContact = firstChannel
        ? allContacts.find(
            (contact) => contact.channelId === firstChannel.channelId
          )
        : null;

      setSelectedContactId(firstContact?._id || '');
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

  const enrichedChats = useMemo(() => {
    const map = new Map();

    for (const chat of chats) {
      const key = chat.conversationKey || `${chat.channelId}::${chat.jid}`;
      map.set(key, chat);
    }

    for (const [conversationKey, socketMessages] of Object.entries(newMessages || {})) {
      if (!Array.isArray(socketMessages) || socketMessages.length === 0) continue;

      const latest = socketMessages[socketMessages.length - 1];
      const existing = map.get(conversationKey);

      if (existing) {
        const latestTime = new Date(latest.timestamp || 0).getTime();
        const existingTime = new Date(existing.lastMessageTime || 0).getTime();
        const unreadFromSocket = socketMessages.filter(
          (message) => !message.fromMe && !message.read
        ).length;

        map.set(conversationKey, {
          ...existing,
          unreadCount: Math.max(
            Number(existing.unreadCount || 0),
            unreadFromSocket
          ),
          lastMessage:
            latestTime > existingTime
              ? latest.content || latest.caption || ''
              : existing.lastMessage,
          lastMessageTime:
            latestTime > existingTime
              ? latest.timestamp
              : existing.lastMessageTime,
        });
        continue;
      }

      // The backend created a new conversation from the inbound message.
      // Show it immediately; the next API refresh will fill its contact details.
      const separator = conversationKey.indexOf('::');
      const channelId = separator >= 0 ? conversationKey.slice(0, separator) : '';
      const jid = separator >= 0 ? conversationKey.slice(separator + 2) : conversationKey;

      map.set(conversationKey, {
        conversationId: null,
        tenantId: user?.tenantId,
        channelId,
        contactId: null,
        jid,
        contactJid: jid,
        conversationKey,
        name: jid.split('@')[0],
        phone: jid.split('@')[0],
        status: 'active',
        isGroup: jid.includes('@g.us'),
        unreadCount: socketMessages.filter(
          (message) => !message.fromMe && !message.read
        ).length,
        lastMessage: latest.content || latest.caption || '',
        lastMessageTime: latest.timestamp,
      });
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0)
    );
  }, [chats, newMessages, user]);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return enrichedChats;
    const q = searchQuery.toLowerCase();

    return enrichedChats.filter(
      (chat) =>
        (chat.name || chat.phone || '').toLowerCase().includes(q) ||
        (chat.lastMessage || '').toLowerCase().includes(q)
    );
  }, [enrichedChats, searchQuery]);

  const channelContacts = useMemo(
    () =>
      contacts.filter(
        (contact) => contact.channelId === selectedChannelId
      ),
    [contacts, selectedChannelId]
  );

  useEffect(() => {
    if (activeChat) {
      const activeKey = activeChat.conversationKey || `${activeChat.channelId}::${activeChat.jid}`;
      const latestActiveChat = enrichedChats.find(
        (c) => (c.conversationKey || `${c.channelId}::${c.jid}`) === activeKey
      );

      if (
        latestActiveChat &&
        (latestActiveChat.updatedAt !== activeChat.updatedAt ||
          latestActiveChat.lastMessageTime !== activeChat.lastMessageTime ||
          latestActiveChat.unreadCount !== activeChat.unreadCount)
      ) {
        onSelectChat(latestActiveChat);
      }
    }
  }, [enrichedChats, activeChat, onSelectChat]);

  useEffect(() => {
    if (channelContacts.length === 0) {
      setSelectedContactId('');
      return;
    }

    if (!channelContacts.some((contact) => contact._id === selectedContactId)) {
      setSelectedContactId(channelContacts[0]._id);
    }
  }, [channelContacts, selectedContactId]);

  const startConversation = async () => {
    const contact = channelContacts.find(
      (item) => String(item._id) === String(selectedContactId)
    );

    if (!selectedChannelId || !contact) {
      return;
    }

    try {
      const res = await conversationsAPI.open({
        channelId: selectedChannelId,
        contactId: contact._id,
        jid: contact.jid,
        name:
          contact.name ||
          contact.pushName ||
          contact.businessName ||
          contact.phone ||
          '',
        phone: contact.phone || '',
      });

      if (!res.data.success || !res.data.data) {
        throw new Error('Conversation could not be created');
      }

      onSelectChat(res.data.data);
      await fetchChats();
      setShowCreateConversation(false);
    } catch (error) {
      console.error('Error creating conversation:', error);
      alert('Could not open this conversation.');
    }
  };

  const handleDeleteConversation = async (event, chat) => {
    event.stopPropagation();

    if (!chat.conversationId) return;
    if (!window.confirm(`Delete conversation ${chat.name || chat.phone || chat.jid}?`)) return;

    try {
      await conversationsAPI.delete(chat.conversationId);
      
      const conversationKey = chat.conversationKey || `${chat.channelId}::${chat.jid}`;
      clearMessagesForConversation(conversationKey);

      setChats((currentChats) =>
        currentChats.filter((item) => item.conversationId !== chat.conversationId)
      );
      if (activeChat?.conversationId === chat.conversationId) {
        onSelectChat(null);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Could not delete conversation.');
    }
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold text-gray-800">WhatsApp CRM</h1>
          <div className="flex items-center gap-2" title="Real-time Server Connection">
            <span
              className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-xs text-gray-500">
              {isConnected ? 'Server Connected' : 'Server Offline'}
            </span>
          </div>
        </div>

        <nav className="flex gap-1 mb-3">
          <button className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md font-medium">
            Chats
          </button>
          <button
            onClick={() => navigate('/contacts')}
            className="px-3 py-1 text-sm bg-white text-gray-600 rounded-md hover:bg-gray-100"
          >
            Contacts
          </button>
          <button
            onClick={() => navigate('/groups')}
            className="px-3 py-1 text-sm bg-white text-gray-600 rounded-md hover:bg-gray-100"
          >
            Groups
          </button>
        </nav>

        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
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
          <div className="p-4 text-center text-gray-400">Loading conversations...</div>
        ) : filteredChats.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            {searchQuery ? 'No chats match your search' : 'No conversations yet'}
          </div>
        ) : (
          filteredChats.map((chat) => {
            const conversationKey =
              chat.conversationKey || `${chat.channelId}::${chat.jid}`;

            return (
              <div
                key={conversationKey}
                onClick={() => onSelectChat(chat)}
                className={`flex items-center p-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                  activeChat?.conversationKey === conversationKey
                    ? 'bg-green-50'
                    : ''
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {(chat.name || chat.phone || '?').charAt(0).toUpperCase()}
                </div>

                <div className="ml-3 flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-gray-900 truncate text-sm">
                      {chat.name || chat.phone || chat.jid}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                      {chat.lastMessageTime
                        ? moment(chat.lastMessageTime).format('HH:mm')
                        : ''}
                    </span>
                  </div>

                  <div className="flex justify-between items-center mt-0.5">
                    <p className="text-sm text-gray-500 truncate">
                      {chat.lastMessage || 'No messages'}
                    </p>

                    <div className="ml-2 flex items-center gap-2 flex-shrink-0">
                      {Number(chat.unreadCount || 0) > 0 && (
                        <span className="bg-green-500 text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                          {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                        </span>
                      )}
                      {chat.conversationId && (
                        <button
                          type="button"
                          onClick={(event) => handleDeleteConversation(event, chat)}
                          className="p-1 rounded text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete conversation"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showCreateConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="font-semibold text-gray-900">Create conversation</h2>
              <button
                type="button"
                onClick={() => setShowCreateConversation(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Select channel
                </label>
                <select
                  value={selectedChannelId}
                  onChange={(event) => setSelectedChannelId(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                >
                  {channels.map((channel) => (
                    <option key={channel.channelId} value={channel.channelId}>
                      {channel.channelName || channel.channelId}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Select contact
                </label>
                <select
                  value={selectedContactId}
                  onChange={(event) => setSelectedContactId(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                >
                  {channelContacts.map((contact) => (
                    <option key={contact._id} value={contact._id}>
                      {contact.name ||
                        contact.pushName ||
                        contact.businessName ||
                        contact.phone ||
                        contact.jid}
                    </option>
                  ))}
                </select>
                {channelContacts.length === 0 && (
                  <p className="mt-1 text-xs text-gray-400">
                    No contacts found for this channel.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t p-4">
              <button
                type="button"
                onClick={() => setShowCreateConversation(false)}
                className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startConversation}
                disabled={!selectedChannelId || !selectedContactId}
                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-300"
              >
                Open conversation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatList;
