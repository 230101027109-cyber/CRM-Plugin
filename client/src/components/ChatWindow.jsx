import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { messagesAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket.jsx';
import moment from 'moment';
import {
  Send,
  Phone,
  Search,
  Smile,
  Paperclip,
  MoreVertical,
  ArrowLeft,
  Check,
  CheckCheck,
} from 'lucide-react';

const MessageInput = ({ onSend }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!message.trim() || sending) {
      return;
    }

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
    <form
      onSubmit={handleSubmit}
      className="bg-gray-50 p-3 flex items-center gap-2"
    >
      <button
        type="button"
        className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
      >
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

      <button
        type="button"
        onClick={() => setShowEmoji(!showEmoji)}
        className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
      >
        <Smile size={20} />
      </button>

      <button
        type="submit"
        disabled={!message.trim() || sending}
        className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:bg-gray-300"
      >
        <Send size={20} />
      </button>
    </form>
  );
};

const ChatWindow = ({ chat, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const seenIdsRef = useRef(new Set());

  const {
    newMessages,
    joinChat,
    leaveChat,
  } = useSocket();

  const conversationKey = chat
    ? chat.conversationKey ||
      `${chat.channelId}::${chat.jid}`
    : '';

  const fetchMessages = useCallback(async () => {
    if (!chat?.jid || !chat?.channelId) {
      return;
    }

    try {
      const res = await messagesAPI.getMessages(
        chat.jid,
        50,
        undefined,
        chat.channelId
      );

      if (res.data.success) {
        const incoming = res.data.data || [];
        seenIdsRef.current = new Set(
          incoming
            .map((message) => message.messageId)
            .filter(Boolean)
        );
        setMessages(incoming);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [chat?.jid, chat?.channelId]);

  const prevJidRef = useRef(null);

  useEffect(() => {
    if (!chat?.jid || !chat?.channelId) {
      setMessages([]);
      setLoading(false);
      return undefined;
    }

    if (prevJidRef.current !== chat.jid) {
      seenIdsRef.current = new Set();
      setMessages([]);
      setLoading(true);
      prevJidRef.current = chat.jid;
    }

    fetchMessages();
    joinChat(chat.jid, chat.channelId);

    return () => {
      leaveChat(chat.jid, chat.channelId);
    };
  }, [
    chat?.jid,
    chat?.channelId,
    chat?.updatedAt,
    fetchMessages,
    joinChat,
    leaveChat,
  ]);

  useEffect(() => {
    if (!conversationKey) {
      return;
    }

    // STRICT: only the exact channel + JID conversation can update this window.
    const incoming = newMessages?.[conversationKey] || [];

    if (!incoming.length) {
      return;
    }

    setMessages((previous) => {
      const updated = [...previous];

      for (const msg of incoming) {
        const msgId = msg.messageId;

        if (msgId && seenIdsRef.current.has(msgId)) {
          continue;
        }

        if (msgId) {
          seenIdsRef.current.add(msgId);
        }

        const optimisticIndex = updated.findIndex(
          (item) =>
            item._optimistic &&
            item.content === msg.content &&
            item.fromMe === true
        );

        if (optimisticIndex !== -1) {
          updated[optimisticIndex] = msg;
        } else {
          updated.push(msg);
        }
      }

      return updated;
    });
  }, [newMessages, conversationKey]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const handleSendMessage = async (content, type = 'text') => {
    if (!content.trim() || sending) {
      return;
    }

    if (!chat?.jid || !chat?.channelId) {
      throw new Error(
        'Conversation is missing channelId or jid'
      );
    }

    setSending(true);

    const optimisticId = `opt_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    seenIdsRef.current.add(optimisticId);

    setMessages((previous) => [
      ...previous,
      {
        messageId: optimisticId,
        remoteJid: chat.jid,
        channelId: chat.channelId,
        content,
        messageType: type,
        fromMe: true,
        timestamp: new Date().toISOString(),
        _optimistic: true,
      },
    ]);

    try {
      const res = await messagesAPI.sendMessage(
        chat.jid,
        content,
        {
          channelId: chat.channelId,
          type,
        }
      );

      if (res.data.success && res.data.messageId) {
        const realId = res.data.messageId;
        seenIdsRef.current.add(realId);

        setMessages((previous) =>
          previous.map((message) =>
            message.messageId === optimisticId
              ? {
                  ...message,
                  messageId: realId,
                  _optimistic: false,
                }
              : message
          )
        );
      }
    } catch (error) {
      setMessages((previous) =>
        previous.map((message) =>
          message.messageId === optimisticId
            ? {
                ...message,
                _failed: true,
              }
            : message
        )
      );
      throw error;
    } finally {
      setSending(false);
    }
  };

  if (!chat) {
    return (
      <div className="flex-1 bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg">
            Select a chat to start messaging
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white h-full">
      <div className="bg-gray-50 p-3 border-b flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 hover:bg-gray-200 rounded-full md:hidden"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium">
          {(chat.name || chat.phone || '?')
            .charAt(0)
            .toUpperCase()}
        </div>

        <div className="flex-1">
          <h2 className="font-medium text-gray-900">
            {chat.name || chat.phone || chat.jid}
          </h2>
          <p className="text-xs text-gray-500">
            {chat.isGroup ? 'Group Chat' : 'WhatsApp'}
          </p>
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
          <div className="text-center text-gray-400 mt-10">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message, index) => {
            const showDate =
              index === 0 ||
              !moment(message.timestamp).isSame(
                moment(messages[index - 1]?.timestamp),
                'day'
              );

            return (
              <React.Fragment
                key={message.messageId || `message_${index}`}
              >
                {showDate && (
                  <div className="flex justify-center my-3">
                    <span className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded-full">
                      {moment(message.timestamp).format('MMM D, YYYY')}
                    </span>
                  </div>
                )}

                <div
                  className={`flex ${
                    message.fromMe
                      ? 'justify-end'
                      : 'justify-start'
                  } mb-1.5 ${
                    message._failed ? 'opacity-70' : ''
                  }`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-3.5 py-2 rounded-xl ${
                      message.fromMe
                        ? 'bg-green-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {message.content}
                    </p>

                    <div
                      className={`flex items-center justify-end gap-1 mt-1 ${
                        message.fromMe
                          ? 'text-green-100'
                          : 'text-gray-400'
                      }`}
                    >
                      <span className="text-[10px] leading-none">
                        {moment(message.timestamp).format('HH:mm')}
                      </span>

                      {message.fromMe &&
                        (message._failed ? (
                          <span className="text-red-300">!</span>
                        ) : message._optimistic ? (
                          <Check size={12} />
                        ) : (
                          <CheckCheck size={12} />
                        ))}
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
