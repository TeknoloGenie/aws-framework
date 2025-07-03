import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { withAuth } from '../contexts/AuthContext';
import { apiQueries } from '../lib/api';
import { useWebSocket } from '../lib/websocket';
import Layout from '../components/layout/Layout';
import PostCard from '../components/posts/PostCard';
import CreatePostModal from '../components/posts/CreatePostModal';
import ChatSidebar from '../components/chat/ChatSidebar';
import ChatWindow from '../components/chat/ChatWindow';
import { Chat } from '../types';
import { PlusIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

function Dashboard() {
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  
  // Initialize WebSocket connection
  const { isConnected, connectionError } = useWebSocket();

  // Fetch posts for the feed
  const { data: postsData, isLoading: postsLoading, error: postsError } = useQuery(
    apiQueries.posts.list({ limit: 20 })
  );

  // Fetch user's chats
  const { data: chatsData } = useQuery(
    apiQueries.chats.list({ limit: 20 })
  );

  const handleChatSelect = (chat: Chat) => {
    setSelectedChat(chat);
    setShowChat(true);
  };

  if (postsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    );
  }

  if (postsError) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600">Failed to load posts. Please try again later.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-3">
            {/* Connection Status */}
            {connectionError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Connection Error
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>Real-time features may not work properly: {connectionError}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isConnected && !connectionError && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Connecting...
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>Establishing real-time connection for live updates.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Create Post Button */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
              <button
                onClick={() => setShowCreatePost(true)}
                className="w-full flex items-center space-x-3 p-3 text-left text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                  <PlusIcon className="w-5 h-5" />
                </div>
                <span>What's on your mind?</span>
              </button>
            </div>

            {/* Posts Feed */}
            <div className="space-y-6">
              {postsData?.items.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
                  <p className="text-gray-600 mb-4">Be the first to share something!</p>
                  <button
                    onClick={() => setShowCreatePost(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Create Post
                  </button>
                </div>
              ) : (
                postsData?.items.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))
              )}
            </div>

            {/* Load More Button */}
            {postsData?.hasMore && (
              <div className="text-center mt-8">
                <button className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors">
                  Load More Posts
                </button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => setShowCreatePost(true)}
                    className="w-full flex items-center space-x-2 p-2 text-left text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>Create Post</span>
                  </button>
                  <button
                    onClick={() => setShowChat(true)}
                    className="w-full flex items-center space-x-2 p-2 text-left text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    <ChatBubbleLeftIcon className="w-4 h-4" />
                    <span>Open Chat</span>
                  </button>
                </div>
              </div>

              {/* Recent Chats */}
              {chatsData?.items && chatsData.items.length > 0 && (
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Recent Chats</h3>
                  <div className="space-y-2">
                    {chatsData.items.slice(0, 5).map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => handleChatSelect(chat)}
                        className="w-full flex items-center space-x-3 p-2 text-left hover:bg-gray-50 rounded-md transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-indigo-600 text-sm font-medium">
                            {(chat.name || 'C')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {chat.name || 'Direct Chat'}
                          </p>
                          {chat.lastMessage && (
                            <p className="text-xs text-gray-500 truncate">
                              {chat.lastMessage.content}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Connection Status */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Status</h3>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm text-gray-600">
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreatePost && (
        <CreatePostModal onClose={() => setShowCreatePost(false)} />
      )}

      {/* Chat Interface */}
      {showChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-96 flex">
            <div className="w-1/3 border-r border-gray-200">
              <ChatSidebar
                chats={chatsData?.items || []}
                selectedChat={selectedChat}
                onChatSelect={handleChatSelect}
              />
            </div>
            <div className="flex-1">
              {selectedChat ? (
                <ChatWindow
                  chat={selectedChat}
                  onClose={() => setShowChat(false)}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  Select a chat to start messaging
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default withAuth(Dashboard);
