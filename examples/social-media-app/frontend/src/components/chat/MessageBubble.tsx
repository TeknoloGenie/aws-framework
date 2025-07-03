import { formatDistanceToNow } from 'date-fns';
import { Message, MessageType } from '../../types';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onReply?: () => void;
}

export default function MessageBubble({ message, isOwn, onReply }: MessageBubbleProps) {
  const renderMessageContent = () => {
    switch (message.messageType) {
      case MessageType.IMAGE:
        return (
          <div className="space-y-2">
            {message.mediaUrl && (
              <img
                src={message.mediaUrl}
                alt="Shared image"
                className="max-w-xs rounded-lg"
              />
            )}
            {message.content !== '📷 Image' && (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
        );

      case MessageType.VIDEO:
        return (
          <div className="space-y-2">
            {message.mediaUrl && (
              <video
                src={message.mediaUrl}
                controls
                className="max-w-xs rounded-lg"
              />
            )}
            {message.content !== '🎥 Video' && (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
        );

      case MessageType.SYSTEM:
        return (
          <p className="text-xs text-gray-500 italic text-center py-2">
            {message.content}
          </p>
        );

      default:
        return <p className="text-sm whitespace-pre-wrap">{message.content}</p>;
    }
  };

  if (message.messageType === MessageType.SYSTEM) {
    return (
      <div className="flex justify-center">
        <div className="bg-gray-100 rounded-full px-3 py-1">
          {renderMessageContent()}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
        {!isOwn && (
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-xs text-gray-600">
                {message.user?.displayName?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {message.user?.displayName || message.user?.username || 'Unknown'}
            </span>
          </div>
        )}
        
        <div
          className={`rounded-lg px-3 py-2 ${
            isOwn
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-900'
          }`}
        >
          {renderMessageContent()}
          
          <div className={`flex items-center justify-between mt-1 text-xs ${
            isOwn ? 'text-indigo-200' : 'text-gray-500'
          }`}>
            <span>
              {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
            </span>
            
            {isOwn && message.readBy.length > 1 && (
              <span>Read by {message.readBy.length - 1}</span>
            )}
          </div>
        </div>

        {onReply && (
          <button
            onClick={onReply}
            className="text-xs text-gray-500 hover:text-gray-700 mt-1"
          >
            Reply
          </button>
        )}
      </div>
    </div>
  );
}
