import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import axios from 'axios';

const ContactList = ({ onSelectContact }) => {
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContacts();
    const interval = setInterval(fetchContacts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await axios.get('/api/contacts/contacts');
      if (res.data.success) setContacts(res.data.data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
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
        <h1 className="text-xl font-semibold text-gray-800 mb-3">Contacts</h1>
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
      <div className="flex-1 overflow-y-auto chat-scroll">
        {loading ? (
          <div className="p-4 text-center text-gray-400">Loading...</div>
        ) : (
          filteredContacts.map(contact => (
            <div
              key={contact.jid}
              onClick={() => onSelectContact(contact)}
              className="flex items-center p-3 cursor-pointer hover:bg-gray-50 border-b"
            >
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium flex-shrink-0">
                {(contact.name || contact.pushName || contact.phone || '?').charAt(0).toUpperCase()}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate text-sm">{contact.name || contact.pushName || contact.phone}</p>
                <p className="text-xs text-gray-500">{contact.phone}</p>
                {contact.isBusiness && <span className="text-xs text-blue-600">Business</span>}
              </div>
              {contact.isOnline && <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ContactList;
