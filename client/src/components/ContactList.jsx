import React, { useEffect, useState } from 'react';
import { Search, UserX, RefreshCw, Plus, X, MessageSquarePlus, Trash2 } from 'lucide-react';
import { contactsAPI, whatsappAPI, channelsAPI } from '../services/api';

const ContactList = ({ onSelectContact }) => {
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [channels, setChannels] = useState([]);
  const [selectedContactForConversation, setSelectedContactForConversation] = useState(null);
  const [selectedContactJid, setSelectedContactJid] = useState('');
  const [conversationChannelId, setConversationChannelId] = useState('');
  const [startingConversation, setStartingConversation] = useState(false);

  useEffect(() => {
    fetchContacts();
    const interval = setInterval(fetchContacts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await contactsAPI.getContacts();
      if (res.data.success) setContacts(res.data.data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await whatsappAPI.sync();
      await fetchContacts();
    } catch (error) {
      console.error('Error syncing contacts:', error);
      alert('Failed to sync contacts. Make sure WhatsApp is connected.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const res = await contactsAPI.update(newContact);
      if (!res.data.success) throw new Error(res.data.message || 'Could not create contact');
      setShowCreate(false);
      setNewContact({ name: '', phone: '' });
      await fetchContacts();
    } catch (error) {
      setCreateError(error.response?.data?.message || error.message || 'Could not create contact');
    } finally {
      setCreating(false);
    }
  };

  const openConversationModal = async (contact = null) => {
    try {
      const res = await channelsAPI.getAll();
      const connectedChannels = (res.data?.data || []).filter(ch => ch.status === 'connected');
      setChannels(connectedChannels);
      if (connectedChannels.length === 0) {
        alert('Connect at least one WhatsApp channel before creating a conversation.');
        return;
      }
      setConversationChannelId(connectedChannels[0].channelId);
      const nextContact = contact || contacts[0] || null;
      setSelectedContactForConversation(nextContact);
      setSelectedContactJid(nextContact ? nextContact.jid : '');
      setShowConversationModal(true);
    } catch (error) {
      console.error('Error loading channels:', error);
      alert('Could not load channels for conversation creation.');
    }
  };

  const handleCreateConversation = async () => {
    const contact = contacts.find(c => c.jid === selectedContactJid) || selectedContactForConversation;
    if (!contact) return;
    setStartingConversation(true);
    try {
      const conversationContact = {
        ...contact,
        channelId: conversationChannelId,
        conversationKey: `${conversationChannelId}::${contact.jid}`,
      };
      onSelectContact(conversationContact);
      setShowConversationModal(false);
      setSelectedContactForConversation(null);
      setSelectedContactJid('');
    } finally {
      setStartingConversation(false);
    }
  };

  const handleDeleteContact = async (contact) => {
    if (!contact?._id) return;
    if (!window.confirm(`Delete contact ${contact.name || contact.phone}?`)) return;

    try {
      await contactsAPI.delete(contact._id);
      await fetchContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Could not delete contact.');
    }
  };

  const filteredContacts = contacts.filter(c =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone || '').includes(searchQuery) ||
    (c.pushName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 bg-gray-50 border-b">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold text-gray-800">Contacts</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setCreateError(''); setShowCreate(true); }}
              title="Create contact"
              className="p-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => openConversationModal()}
              title="Create conversation"
              className="p-1.5 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <MessageSquarePlus size={16} />
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              title="Sync from WhatsApp"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-green-500"
          />
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
        </div>
      </div>
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="w-full max-w-sm rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="font-semibold text-gray-900">Create contact</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input required value={newContact.name} onChange={e => setNewContact(prev => ({ ...prev, name: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none" placeholder="Contact name" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">WhatsApp number</label>
                <input required inputMode="tel" value={newContact.phone} onChange={e => setNewContact(prev => ({ ...prev, phone: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none" placeholder="e.g. 919876543210" />
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button disabled={creating} type="submit" className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-300">{creating ? 'Creating...' : 'Create contact'}</button>
            </div>
          </form>
        </div>
      )}
      <div className="flex-1 overflow-y-auto chat-scroll">
        {loading ? (
          <div className="p-4 text-center text-gray-400">Loading...</div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <UserX size={28} className="text-gray-400" />
            </div>
            <p className="text-gray-700 font-medium">No contacts found</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery ? 'Try a different search term.' : 'Contacts will appear here once you sync them from WhatsApp.'}
            </p>
          </div>
        ) : (
          filteredContacts.map(contact => (
            <div
              key={contact.jid}
              className="flex items-center p-3 border-b hover:bg-gray-50"
            >
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium flex-shrink-0">
                {(contact.name || contact.pushName || contact.phone || '?').charAt(0).toUpperCase()}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate text-sm">{contact.name || contact.pushName || contact.phone}</p>
                <p className="text-xs text-gray-500">{contact.phone}</p>
                {contact.isBusiness && <span className="text-xs text-blue-600">Business</span>}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteContact(contact)}
                className="ml-2 p-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                title="Delete contact"
              >
                <Trash2 size={14} />
              </button>
              {contact.isOnline && <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 ml-2"></span>}
            </div>
          ))
        )}
      </div>

      {showConversationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="font-semibold text-gray-900">Create conversation</h2>
              <button type="button" onClick={() => setShowConversationModal(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Select channel</label>
                <select
                  value={conversationChannelId}
                  onChange={e => setConversationChannelId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                >
                  {channels.map(channel => (
                    <option key={channel.channelId} value={channel.channelId}>{channel.channelName || channel.channelId}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Contact</label>
                <input
                  readOnly
                  value={selectedContactForConversation ? (selectedContactForConversation.name || selectedContactForConversation.phone) : ''}
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <button type="button" onClick={() => setShowConversationModal(false)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button disabled={startingConversation || !selectedContactForConversation} type="button" onClick={handleCreateConversation} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-300">
                {startingConversation ? 'Starting...' : 'Open conversation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactList;
