import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Post } from '../../types';

interface PostMenuProps {
  post: Post;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function PostMenu({ post, onEdit, onDelete, onClose }: PostMenuProps) {
  return (
    <div className="absolute right-0 top-8 z-10">
      <div className="bg-white rounded-md shadow-lg border border-gray-200 py-1 min-w-[120px]">
        <button
          onClick={() => {
            onEdit();
            onClose();
          }}
          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <PencilIcon className="w-4 h-4 mr-2" />
          Edit
        </button>
        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          <TrashIcon className="w-4 h-4 mr-2" />
          Delete
        </button>
      </div>
    </div>
  );
}
