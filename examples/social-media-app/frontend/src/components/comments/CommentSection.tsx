import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiQueries } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { CreateCommentRequest } from '../../types';
import toast from 'react-hot-toast';
import CommentItem from './CommentItem';

interface CommentSectionProps {
  postId: string;
}

export default function CommentSection({ postId }: CommentSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);

  // Fetch comments
  const { data: commentsData, isLoading } = useQuery(
    apiQueries.comments.list(postId, { includeReplies: true })
  );

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: (data: CreateCommentRequest) => apiClient.createComment(postId, data),
    onSuccess: () => {
      setNewComment('');
      setReplyToId(null);
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      toast.success('Comment added successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add comment');
    }
  });

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim()) return;
    if (!user) {
      toast.error('Please sign in to comment');
      return;
    }

    createCommentMutation.mutate({
      content: newComment.trim(),
      parentId: replyToId || undefined
    });
  };

  const handleReply = (commentId: string) => {
    setReplyToId(commentId);
    // Focus on the comment input
    const input = document.getElementById('comment-input');
    input?.focus();
  };

  const cancelReply = () => {
    setReplyToId(null);
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Comment Form */}
      <form onSubmit={handleSubmitComment} className="space-y-3">
        {replyToId && (
          <div className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded-md">
            <span className="text-sm text-blue-700">Replying to comment</span>
            <button
              type="button"
              onClick={cancelReply}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Cancel
            </button>
          </div>
        )}
        
        <div className="flex space-x-3">
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            {user?.displayName?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            <textarea
              id="comment-input"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyToId ? 'Write a reply...' : 'Write a comment...'}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={!newComment.trim() || createCommentMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {createCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-4">
        {commentsData?.items.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No comments yet. Be the first to comment!</p>
        ) : (
          commentsData?.items.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={handleReply}
            />
          ))
        )}
      </div>

      {/* Load More */}
      {commentsData?.hasMore && (
        <div className="text-center">
          <button className="text-indigo-600 hover:text-indigo-800 text-sm">
            Load more comments
          </button>
        </div>
      )}
    </div>
  );
}
