import { ChatBubbleLeftIcon, HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/react/24/solid";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";
import { apiClient } from "../../lib/api";
import { Comment } from "../../types";

interface CommentItemProps {
  comment: Comment;
  onReply: (commentId: string) => void;
  level?: number;
}

export default function CommentItem({ comment, onReply, level = 0 }: CommentItemProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [showReplies, setShowReplies] = useState(false);

    const isLiked = user ? comment.likedBy.includes(user.id) : false;
    const canEdit = user && (user.id === comment.userId || user.role === "admin" || user.role === "moderator");

    const likeMutation = useMutation({
        mutationFn: async () => {
            if (isLiked) {
                await apiClient.unlikeComment(comment.id);
            } else {
                await apiClient.likeComment(comment.id);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["comments", comment.postId] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Failed to update like");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: () => apiClient.deleteComment(comment.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["comments", comment.postId] });
            toast.success("Comment deleted successfully");
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Failed to delete comment");
        }
    });

    const handleLike = () => {
        if (!user) {
            toast.error("Please sign in to like comments");
            return;
        }
        likeMutation.mutate();
    };

    const handleDelete = () => {
        if (window.confirm("Are you sure you want to delete this comment?")) {
            deleteMutation.mutate();
        }
    };

    const marginLeft = level * 40; // Indent nested comments

    return (
        <div className="space-y-3" style={{ marginLeft: `${marginLeft}px` }}>
            <div className="flex space-x-3">
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                    {comment.user?.displayName?.[0]?.toUpperCase() || "U"}
                </div>

                <div className="flex-1">
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium text-gray-900 text-sm">
                                {comment.user?.displayName || comment.user?.username || "Unknown User"}
                            </h4>
                            <span className="text-xs text-gray-500">
                                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                            </span>
                        </div>
                        <p className="text-gray-800 text-sm whitespace-pre-wrap">{comment.content}</p>
                    </div>

                    {/* Comment Actions */}
                    <div className="flex items-center space-x-4 mt-2">
                        <button
                            onClick={handleLike}
                            disabled={likeMutation.isPending}
                            className={`flex items-center space-x-1 text-xs transition-colors ${
                                isLiked
                                    ? "text-red-500 hover:text-red-600"
                                    : "text-gray-500 hover:text-red-500"
                            }`}
                        >
                            {isLiked ? (
                                <HeartSolidIcon className="w-4 h-4" />
                            ) : (
                                <HeartIcon className="w-4 h-4" />
                            )}
                            <span>{comment.likes}</span>
                        </button>

                        <button
                            onClick={() => onReply(comment.id)}
                            className="flex items-center space-x-1 text-xs text-gray-500 hover:text-blue-500 transition-colors"
                        >
                            <ChatBubbleLeftIcon className="w-4 h-4" />
                            <span>Reply</span>
                        </button>

                        {comment.replyCount > 0 && level === 0 && (
                            <button
                                onClick={() => setShowReplies(!showReplies)}
                                className="text-xs text-indigo-600 hover:text-indigo-800"
                            >
                                {showReplies ? "Hide" : "Show"} {comment.replyCount} {comment.replyCount === 1 ? "reply" : "replies"}
                            </button>
                        )}

                        {canEdit && (
                            <button
                                onClick={handleDelete}
                                disabled={deleteMutation.isPending}
                                className="text-xs text-red-500 hover:text-red-700"
                            >
                Delete
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Nested Replies */}
            {showReplies && comment.replies && comment.replies.length > 0 && (
                <div className="space-y-3">
                    {comment.replies.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            onReply={onReply}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
