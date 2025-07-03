import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Chat } from '../../types';

interface ChatSidebarProps {
  chats: Chat[];
  selectedChat: Chat | null;
  onChatSelect: (chat: Chat) => void;
}

export default function ChatSidebar({ chats, selectedChat, onChatSelect }: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChats = chats.filter(chat => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      chat.name?.toLowerCase().includes(query) ||
      chat.lastMessage?.content.toLowerCase().includes(query)
    );
  });

  const getChatTitle = (chat: Chat) => {
    if (chat.type === 'group') {
      return chat.name || 'Group Chat';
    } else {
      // For direct chats, you'd typically show the other participant's name
      // This would require additional user data
      return 'Direct Chat';
    }
  };

  const getChatSubtitle = (chat: Chat) => {
    if (chat.lastMessage) {
      return chat.lastMessage.content;
    }
    return 'No messages yet';
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
          <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <PlusIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery ? 'No chats found' : 'No conversations yet'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onChatSelect(chat)}
                className={`w-full p-4 text-left hover:bg-gray-100 transition-colors ${
                  selectedChat?.id === chat.id ? 'bg-indigo-50 border-r-2 border-indigo-500' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <span className="text-indigo-600 font-medium">
                      {getChatTitle(chat)[0].toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 truncate">
                        {getChatTitle(chat)}
                      </h3>
                      {chat.lastActivity && (
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(chat.lastActivity), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 truncate">
                      {getChatSubtitle(chat)}
                    </p>
                    
                    {chat.type === 'group' && (
                      <p className="text-xs text-gray-500">
                        {chat.participants.length} members
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
