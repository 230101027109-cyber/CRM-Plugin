import React, { useState, useEffect, useRef, useCallback } from 'react';
import { contactsAPI, messagesAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket.jsx';
import moment from 'moment';
import { Send, Phone, Search, Smile, Paperclip, MoreVertical, ArrowLeft } from 'lucide-react';

const MessageInput = ({ remoteJid, onSend }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await onSend(message, 'text');
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 p-3 flex items-center gap-2">
      <button type="button" className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
        <Paperclip size={20} />
      </button>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:border-green-500"
        disabled={sending}
      />
      <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
        <Smile size={20} />
      </button>
      <button type="submit" disabled={!message.trim() || sending} className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:bg-gray-300">
        <Send size={20} />
      </button>
    </form>
  );
};

const ChatWindow = ({ chat, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const { newMessages, joinChat, leaveChat } = useSocket();

  useEffect(() => {
    if (!chat) return;
    fetchMessages();
    joinChat(chat.jid);
    return () => leaveChat(chat.jid);
  }, [chat]);

  useEffect(() => {
    const incoming = newMessages?.[chat?.jid] || [];
    if (incoming.length > 0) {
      setMessages(prev => [...prev, incoming[incoming.length - 1]]);
    }
  }, [newMessages]);

  const fetchMessages = async () => {
    try {
      const res = await messagesAPI.getMessages(chat.jid, 50);
      if (res.data.success) setMessages(res.data.data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [chat]);

  const handleSendMessage = async (content, type = 'text') => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      await messagesAPI.sendMessage(chat.jid, content, { channelId: chat.channelId, type });
      setMessages(prev => [...prev, {
        remoteJid: chat.jid,
        content,
        messageType: type,
        fromMe: true,
        timestamp: new Date(),
        messageId: Date.now().toString(),
      }]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(newMessage);
      setNewMessage('');
    }
  };

  if (!chat) {
    return (
      <div className="flex-1 bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg">Select a chat to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white h-full">
      <div className="bg-gray-50 p-3 border-b flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="p-1 hover:bg-gray-200 rounded-full md:hidden">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium">
          {chat.name?.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="flex-1">
          <h2 className="font-medium text-gray-900">{chat.name || chat.phone}</h2>
          <p className="text-xs text-gray-500">{chat.isGroup ? 'Group Chat' : chat.isOnline ? 'Online' : 'last seen recently'}</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200">
            <Search size={18} />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200">
            <Phone size={18} />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 chat-scroll bg-gray-50">
        {loading ? (
          <div className="text-center text-gray-400 mt-10">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((msg, idx) => (
            <div key={msg.messageId || idx} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'} mb-2`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                msg.fromMe
                  ? 'bg-green-600 text-white rounded-br-none'
                  : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
              }`}>
                {msg.messageType === 'text' && (
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                )}
                {msg.messageType !== 'text' && (
                  <div className="text-sm flex items-center gap-1">
                    <Paperclip size={14} />
                    <span>{msg.messageType}</span>
                  </div>
                )}
                <p className={`text-xs mt-1 ${msg.fromMe ? 'text-green-100' : 'text-gray-400'}`}>
                  {moment(msg.timestamp).format('HH:mm')}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t bg-white">
        <MessageInput onSend={handleSendMessage} />
      </div>
    </div>
  );
};

export default ChatWindow;
