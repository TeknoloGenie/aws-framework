import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { 
  PaperAirplaneIcon, 
  PhotoIcon, 
  FaceSmileIcon,
  EllipsisVerticalIcon 
} from '@heroicons/react/24/outline';
import { Chat, Message, SendMessageRequest, MessageType, WebSocketMessageType } from '../../types';
import { apiClient, apiQueries } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useWebSocketEvent } from '../../lib/websocket';
import toast from 'react-hot-toast';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import FileUploadModal from '../common/FileUploadModal';

interface ChatWindowProps {
  chat: Chat;
  onClose?: () => void;
}

export default function ChatWindow({ chat, onClose }: ChatWindowProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);

  // Fetch messages
  const { data: messagesData, isLoading } = useQuery(
    apiQueries.messages.list(chat.id, { limit: 50 })
  );

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (data: SendMessageRequest) => apiClient.sendMessage(chat.id, data),
    onSuccess: () => {
      setMessage('');
      setReplyToMessage(null);
      queryClient.invalidateQueries({ queryKey: ['messages', chat.id] });
      scrollToBottom();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to send message');
    }
  });

  // WebSocket event handlers
  useWebSocketEvent(WebSocketMessageType.MESSAGE_SENT, (data) => {
    if (data.chatId === chat.id) {
      queryClient.invalidateQueries({ queryKey: ['messages', chat.id] });
      scrollToBottom();
    }
  });

  useWebSocketEvent(WebSocketMessageType.USER_TYPING, (data) => {
    if (data.chatId === chat.id && data.userId !== user?.id) {
      if (data.isTyping) {
        setTypingUsers(prev => [...prev.filter(id => id !== data.userId), data.userId]);
      } else {
        setTypingUsers(prev => prev.filter(id => id !== data.userId));
      }
    }
  });

  useWebSocketEvent(WebSocketMessageType.MESSAGE_READ, (data) => {
    if (data.chatId === chat.id) {
      queryClient.invalidateQueries({ queryKey: ['messages', chat.id] });
    }
  });

  // Typing indicator
  useEffect(() => {
    let typingTimer: NodeJS.Timeout;
    
    if (isTyping) {
      // Send typing indicator
      // webSocketService.sendTyping(chat.id, true);
      
      typingTimer = setTimeout(() => {
        setIsTyping(false);
        // webSocketService.sendTyping(chat.id, false);
      }, 3000);
    }

    return () => {
      if (typingTimer) clearTimeout(typingTimer);
    };
  }, [isTyping, chat.id]);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messagesData]);

  // Handle message input
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    if (!isTyping && e.target.value.trim()) {
      setIsTyping(true);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    if (!message.trim() || sendMessageMutation.isPending) return;

    const messageData: SendMessageRequest = {
      content: message.trim(),
      messageType: MessageType.TEXT,
      replyToId: replyToMessage?.id
    };

    sendMessageMutation.mutate(messageData);
  };

  const handleFileUpload = (fileUrl: string, fileType: 'image' | 'video') => {
    const messageData: SendMessageRequest = {
      content: fileType === 'image' ? '📷 Image' : '🎥 Video',
      messageType: fileType === 'image' ? MessageType.IMAGE : MessageType.VIDEO,
      mediaUrl: fileUrl
    };

    sendMessageMutation.mutate(messageData);
    setShowFileUpload(false);
  };

  const getChatTitle = () => {
    if (chat.type === 'group') {
      return chat.name || 'Group Chat';
    } else {
      // For direct chats, show the other participant's name
      const otherParticipant = chat.participantUsers?.find(p => p.id !== user?.id);
      return otherParticipant?.displayName || otherParticipant?.username || 'Direct Chat';
    }
  };

  const getChatSubtitle = () => {
    if (chat.type === 'group') {
      return `${chat.participants.length} members`;
    } else {
      const otherParticipant = chat.participantUsers?.find(p => p.id !== user?.id);
      return otherParticipant?.isOnline ? 'Online' : 
        otherParticipant?.lastSeen ? `Last seen ${formatDistanceToNow(new Date(otherParticipant.lastSeen), { addSuffix: true })}` : 
        'Offline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
            <span className="text-indigo-600 font-medium">
              {getChatTitle()[0].toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{getChatTitle()}</h3>
            <p className="text-sm text-gray-500">{getChatSubtitle()}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <EllipsisVerticalIcon className="w-5 h-5 text-gray-500" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messagesData?.items.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.userId === user?.id}
            onReply={() => setReplyToMessage(msg)}
          />
        ))}
        
        {typingUsers.length > 0 && (
          <TypingIndicator users={typingUsers} />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview */}
      {replyToMessage && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-600">
                Replying to <span className="font-medium">{replyToMessage.user?.displayName}</span>
              </p>
              <p className="text-sm text-gray-800 truncate">{replyToMessage.content}</p>
            </div>
            <button
              onClick={() => setReplyToMessage(null)}
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-end space-x-2">
          <button
            onClick={() => setShowFileUpload(true)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <PhotoIcon className="w-6 h-6 text-gray-500" />
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={message}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-2 border border-gray-300 rounded-full resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>

          <button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* File Upload Modal */}
      {showFileUpload && (
        <FileUploadModal
          uploadType="message"
          onUpload={handleFileUpload}
          onClose={() => setShowFileUpload(false)}
        />
      )}
    </div>
  );
}
