import { useState } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { 
  HeartIcon, 
  ChatBubbleLeftIcon, 
  ShareIcon,
  EllipsisHorizontalIcon 
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { Post } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CommentSection from '../comments/CommentSection';
import PostMenu from './PostMenu';

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isLiked = user ? post.likedBy.includes(user.id) : false;
  const canEdit = user && (user.id === post.userId || user.role === 'admin' || user.role === 'moderator');

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (isLiked) {
        await apiClient.unlikePost(post.id);
      } else {
        await apiClient.likePost(post.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update like');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deletePost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete post');
    }
  });

  const handleLike = () => {
    if (!user) {
      toast.error('Please sign in to like posts');
      return;
    }
    likeMutation.mutate();
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      deleteMutation.mutate();
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${post.user?.displayName || post.user?.username}`,
          text: post.content,
          url: window.location.href
        });
      } catch (error) {
        // User cancelled sharing
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard');
      } catch (error) {
        toast.error('Failed to copy link');
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 mb-4">
      {/* Post Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
            {post.user?.profilePicture ? (
              <Image
                src={post.user.profilePicture}
                alt={post.user.displayName || post.user.username}
                width={40}
                height={40}
                className="object-cover"
              />
            ) : (
              <span className="text-gray-600 font-medium">
                {(post.user?.displayName || post.user?.username || 'U')[0].toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {post.user?.displayName || post.user?.username || 'Unknown User'}
            </h3>
            <p className="text-sm text-gray-500">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <EllipsisHorizontalIcon className="w-5 h-5 text-gray-500" />
            </button>
            {showMenu && (
              <PostMenu
                post={post}
                onEdit={() => {/* Implement edit functionality */}}
                onDelete={handleDelete}
                onClose={() => setShowMenu(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Post Content */}
      <div className="px-4 pb-3">
        <p className="text-gray-900 whitespace-pre-wrap">{post.content}</p>
      </div>

      {/* Post Media */}
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className="px-4 pb-3">
          {post.mediaType === 'image' ? (
            <div className="grid grid-cols-1 gap-2">
              {post.mediaUrls.map((url, index) => (
                <div key={index} className="relative rounded-lg overflow-hidden">
                  <Image
                    src={url}
                    alt={`Post image ${index + 1}`}
                    width={600}
                    height={400}
                    className="object-cover w-full"
                  />
                </div>
              ))}
            </div>
          ) : post.mediaType === 'video' ? (
            <div className="rounded-lg overflow-hidden">
              <video
                controls
                className="w-full"
                preload="metadata"
              >
                <source src={post.mediaUrls[0]} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          ) : null}
        </div>
      )}

      {/* Post Actions */}
      <div className="px-4 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button
              onClick={handleLike}
              disabled={likeMutation.isPending}
              className={`flex items-center space-x-2 transition-colors ${
                isLiked 
                  ? 'text-red-500 hover:text-red-600' 
                  : 'text-gray-500 hover:text-red-500'
              }`}
            >
              {isLiked ? (
                <HeartSolidIcon className="w-6 h-6" />
              ) : (
                <HeartIcon className="w-6 h-6" />
              )}
              <span className="text-sm font-medium">{post.likes}</span>
            </button>

            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors"
            >
              <ChatBubbleLeftIcon className="w-6 h-6" />
              <span className="text-sm font-medium">{post.commentCount}</span>
            </button>

            <button
              onClick={handleShare}
              className="flex items-center space-x-2 text-gray-500 hover:text-green-500 transition-colors"
            >
              <ShareIcon className="w-6 h-6" />
              <span className="text-sm font-medium">Share</span>
            </button>
          </div>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-gray-200">
          <CommentSection postId={post.id} />
        </div>
      )}
    </div>
  );
}
