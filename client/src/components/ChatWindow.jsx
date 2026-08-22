import React, { useState, useEffect, useRef, useCallback } from 'react';
import { messagesAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket.jsx';
import moment from 'moment';
import { Send, Phone, Search, Smile, Paperclip, MoreVertical, ArrowLeft, Check, CheckCheck } from 'lucide-react';

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
  const [sending, setSending] = useState(false);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const messagesEndRef = useRef(null);
  const seenIdsRef = useRef(new Set());
  const { newMessages, joinChat, leaveChat } = useSocket();

  // Fetch messages on chat change
  const conversationKey = chat ? (chat.conversationKey || `${chat.channelId || 'no-channel'}::${chat.jid}`) : '';

  useEffect(() => {
    if (!chat) return;
    seenIdsRef.current = new Set();
    setInitialScrollDone(false);
    setLoading(true);
    fetchMessages();
    joinChat(chat.jid, chat.channelId);
    return () => leaveChat(chat.jid, chat.channelId);
  }, [chat?.jid, chat?.channelId]);

  const fetchMessages = async () => {
    try {
      const res = await messagesAPI.getMessages(chat.jid, 50, undefined, chat.channelId);
      if (res.data.success) {
        const msgs = res.data.data || [];
        // Populate seen IDs from fetched messages
        msgs.forEach(m => { if (m.messageId) seenIdsRef.current.add(m.messageId); });
        setMessages(msgs);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle real-time incoming messages from socket with dedup
  useEffect(() => {
    const incoming = newMessages?.[conversationKey] || newMessages?.[chat?.jid] || [];
    if (incoming.length === 0) return;

    setMessages(prev => {
      const updated = [...prev];
      let changed = false;

      for (const msg of incoming) {
        // Dedup: skip if we've already seen this messageId
        if (msg.messageId && seenIdsRef.current.has(msg.messageId)) continue;
        if (msg.messageId) seenIdsRef.current.add(msg.messageId);

        // Try to replace optimistic message (local temp ID) with server version
        const optimisticIdx = updated.findIndex(m =>
          !m.messageId?.startsWith('BAILEYS') &&
          m.content === msg.content &&
          m.fromMe === true &&
          Math.abs(new Date(m.timestamp) - new Date(msg.timestamp)) < 3000
        );

        if (optimisticIdx !== -1) {
          updated[optimisticIdx] = msg;
        } else {
          updated.push(msg);
        }
        changed = true;
      }

      return changed ? updated : prev;
    });
  }, [newMessages]);

  // Instant scroll to bottom on initial message load
  useEffect(() => {
    if (!initialScrollDone && messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
      setInitialScrollDone(true);
    }
  }, [messages, initialScrollDone]);

  // Smooth auto-scroll for new messages only if user is near bottom
  const isNearBottom = useCallback(() => {
    const el = messagesEndRef.current?.parentElement;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  }, []);

  useEffect(() => {
    if (initialScrollDone && isNearBottom() && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, initialScrollDone, isNearBottom]);

  const handleSendMessage = async (content, type = 'text') => {
    if (!content.trim() || sending) return;
    setSending(true);

    const optimisticId = `opt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    seenIdsRef.current.add(optimisticId);

    const optimisticMsg = {
      remoteJid: chat.jid,
      channelId: chat.channelId,
      content,
      messageType: type,
      fromMe: true,
      timestamp: new Date().toISOString(),
      messageId: optimisticId,
      _optimistic: true,
    };

    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await messagesAPI.sendMessage(chat.jid, content, { channelId: chat.channelId, type });
      if (res.data.success && res.data.messageId) {
        // Replace optimistic with server-confirmed message
        seenIdsRef.current.add(res.data.messageId);
        setMessages(prev => prev.map(m =>
          m.messageId === optimisticId
            ? { ...m, messageId: res.data.messageId, _optimistic: false }
            : m
        ));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Mark the optimistic message as failed
      setMessages(prev => prev.map(m =>
        m.messageId === optimisticId ? { ...m, _failed: true } : m
      ));
    } finally {
      setSending(false);
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
          messages.map((msg, idx) => {
            const showDate = idx === 0 || !moment(msg.timestamp).isSame(moment(messages[idx-1]?.timestamp), 'day');
            return (
              <React.Fragment key={msg.messageId || `msg_${idx}`}>
                {showDate && (
                  <div className="flex justify-center my-3">
                    <span className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded-full">
                      {moment(msg.timestamp).format('MMM D, YYYY')}
                    </span>
                  </div>
                )}
                <div className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'} mb-1.5 ${msg._failed ? 'opacity-70' : ''}`}>
                  <div className={`max-w-xs lg:max-w-md px-3.5 py-2 rounded-xl ${
                    msg.fromMe
                      ? 'bg-green-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200'
                  }`}>
                    {msg.messageType === 'text' && (
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                    )}
                    {msg.messageType !== 'text' && (
                      <div className="text-sm flex items-center gap-1.5">
                        <Paperclip size={14} />
                        <span className="capitalize">{msg.messageType}</span>
                      </div>
                    )}
                    <div className={`flex items-center justify-end gap-1 mt-1 ${msg.fromMe ? 'text-green-100' : 'text-gray-400'}`}>
                      <span className="text-[10px] leading-none">
                        {moment(msg.timestamp).format('HH:mm')}
                      </span>
                      {msg.fromMe && (
                        msg._failed ? (
                          <span className="text-red-300" title="Failed to send">!</span>
                        ) : msg._optimistic ? (
                          <Check size={12} className="text-green-200" />
                        ) : (
                          <CheckCheck size={12} className="text-green-200" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
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
