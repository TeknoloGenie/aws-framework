import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { apiClient } from '../../lib/api';
import { CreatePostRequest } from '../../types';
import toast from 'react-hot-toast';
import FileUploadModal from '../common/FileUploadModal';

interface CreatePostModalProps {
  onClose: () => void;
}

export default function CreatePostModal({ onClose }: CreatePostModalProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<'image' | 'video' | undefined>();
  const [isPublic, setIsPublic] = useState(true);
  const [showFileUpload, setShowFileUpload] = useState(false);

  const createPostMutation = useMutation({
    mutationFn: (data: CreatePostRequest) => apiClient.createPost(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post created successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create post');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim() && mediaUrls.length === 0) {
      toast.error('Please add some content or media to your post');
      return;
    }

    const postData: CreatePostRequest = {
      content: content.trim(),
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      mediaType,
      isPublic
    };

    createPostMutation.mutate(postData);
  };

  const handleFileUpload = (fileUrl: string, fileType: 'image' | 'video') => {
    setMediaUrls(prev => [...prev, fileUrl]);
    setMediaType(fileType);
    setShowFileUpload(false);
  };

  const removeMedia = (index: number) => {
    setMediaUrls(prev => prev.filter((_, i) => i !== index));
    if (mediaUrls.length === 1) {
      setMediaType(undefined);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Create Post</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Content */}
          <div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Media Preview */}
          {mediaUrls.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Media</h4>
              <div className="grid grid-cols-2 gap-2">
                {mediaUrls.map((url, index) => (
                  <div key={index} className="relative">
                    {mediaType === 'image' ? (
                      <img
                        src={url}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-24 object-cover rounded-md"
                      />
                    ) : (
                      <video
                        src={url}
                        className="w-full h-24 object-cover rounded-md"
                        controls
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Privacy Setting */}
          <div className="flex items-center space-x-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm text-gray-700">Make this post public</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowFileUpload(true)}
              className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              <PhotoIcon className="w-5 h-5" />
              <span>Add Media</span>
            </button>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createPostMutation.isPending || (!content.trim() && mediaUrls.length === 0)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createPostMutation.isPending ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* File Upload Modal */}
      {showFileUpload && (
        <FileUploadModal
          uploadType="post"
          onUpload={handleFileUpload}
          onClose={() => setShowFileUpload(false)}
        />
      )}
    </div>
  );
}
