// User types
export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  profilePicture?: string;
  bio?: string;
  role: UserRole;
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  ADMIN = "admin",
  MODERATOR = "moderator",
  USER = "user"
}

// Post types
export interface Post {
  id: string;
  userId: string;
  content: string;
  mediaUrls?: string[];
  mediaType?: "image" | "video";
  likes: number;
  likedBy: string[];
  commentCount: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  user?: User;
}

export interface CreatePostRequest {
  content: string;
  mediaUrls?: string[];
  mediaType?: "image" | "video";
  isPublic?: boolean;
}

// Comment types
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  parentId?: string;
  content: string;
  likes: number;
  likedBy: string[];
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  user?: User;
  replies?: Comment[];
}

export interface CreateCommentRequest {
  content: string;
  parentId?: string;
}

// Chat types
export interface Chat {
  id: string;
  type: ChatType;
  name?: string;
  description?: string;
  participants: string[];
  admins: string[];
  lastMessage?: Message;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
  participantUsers?: User[];
}

export enum ChatType {
  DIRECT = "direct",
  GROUP = "group"
}

export interface Message {
  id: string;
  chatId: string;
  userId: string;
  content: string;
  messageType: MessageType;
  mediaUrl?: string;
  replyToId?: string;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
  user?: User;
}

export enum MessageType {
  TEXT = "text",
  IMAGE = "image",
  VIDEO = "video",
  FILE = "file",
  SYSTEM = "system"
}

export interface CreateChatRequest {
  type: ChatType;
  name?: string;
  description?: string;
  participants: string[];
}

export interface SendMessageRequest {
  content: string;
  messageType?: MessageType;
  mediaUrl?: string;
  replyToId?: string;
}

// WebSocket types
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
  timestamp: string;
}

export enum WebSocketMessageType {
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  POST_CREATED = "post.created",
  POST_UPDATED = "post.updated",
  POST_DELETED = "post.deleted",
  POST_LIKED = "post.liked",
  COMMENT_ADDED = "comment.added",
  COMMENT_UPDATED = "comment.updated",
  COMMENT_DELETED = "comment.deleted",
  MESSAGE_SENT = "message.sent",
  MESSAGE_READ = "message.read",
  USER_TYPING = "user.typing",
  USER_ONLINE = "user.online",
  USER_OFFLINE = "user.offline",
  NOTIFICATION = "notification",
  ERROR = "error"
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
  hasMore: boolean;
  total?: number;
}

// Authentication types
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: UserRole;
  accessToken: string;
  refreshToken: string;
}

// File upload types
export interface FileUploadRequest {
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadType: "profile" | "post" | "message";
}

export interface FileUploadResponse {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
}

// UI State types
export interface NotificationState {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface TypingState {
  chatId: string;
  users: {
    userId: string;
    username: string;
  }[];
}

export interface OnlineUsersState {
  [userId: string]: {
    isOnline: boolean;
    lastSeen: string;
  };
}
