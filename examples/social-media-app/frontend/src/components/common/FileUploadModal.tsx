import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { XMarkIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { apiClient } from '../../lib/api';
import { FileUploadRequest } from '../../types';
import toast from 'react-hot-toast';

interface FileUploadModalProps {
  uploadType: 'profile' | 'post' | 'message';
  onUpload: (fileUrl: string, fileType: 'image' | 'video') => void;
  onClose: () => void;
}

export default function FileUploadModal({ uploadType, onUpload, onClose }: FileUploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    
    // Validate file
    const maxSize = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024; // 100MB for video, 10MB for images
    if (file.size > maxSize) {
      toast.error(`File too large. Maximum size is ${file.type.startsWith('video/') ? '100MB' : '10MB'}`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Get upload URL
      const uploadRequest: FileUploadRequest = {
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        uploadType
      };

      const uploadResponse = await apiClient.getUploadUrl(uploadRequest);

      // Upload file with progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const fileType = file.type.startsWith('video/') ? 'video' : 'image';
          onUpload(uploadResponse.publicUrl, fileType);
          toast.success('File uploaded successfully');
        } else {
          toast.error('Upload failed');
        }
        setUploading(false);
      });

      xhr.addEventListener('error', () => {
        toast.error('Upload failed');
        setUploading(false);
      });

      xhr.open('PUT', uploadResponse.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);

    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Upload failed');
      setUploading(false);
    }
  }, [uploadType, onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.webm', '.mov', '.avi']
    },
    maxFiles: 1,
    disabled: uploading
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Upload File</h2>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Upload Area */}
        <div className="p-6">
          {!uploading ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
              }`}
            >
              <input {...getInputProps()} />
              <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              
              {isDragActive ? (
                <p className="text-indigo-600">Drop the file here...</p>
              ) : (
                <div>
                  <p className="text-gray-600 mb-2">
                    Drag & drop a file here, or click to select
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM, MOV, AVI)
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Max size: 10MB for images, 100MB for videos
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <CloudArrowUpIcon className="w-12 h-12 text-indigo-500 mx-auto mb-4 animate-pulse" />
              <p className="text-gray-600 mb-4">Uploading...</p>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500">{uploadProgress}%</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
