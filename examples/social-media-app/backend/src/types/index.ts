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
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user'
}

// Post types
export interface Post {
  id: string;
  userId: string;
  content: string;
  mediaUrls?: string[];
  mediaType?: 'image' | 'video';
  likes: number;
  likedBy: string[];
  commentCount: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  user?: User; // Populated in responses
}

export interface CreatePostRequest {
  content: string;
  mediaUrls?: string[];
  mediaType?: 'image' | 'video';
  isPublic?: boolean;
}

// Comment types
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  parentId?: string; // For nested comments
  content: string;
  likes: number;
  likedBy: string[];
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  user?: User; // Populated in responses
  replies?: Comment[]; // Populated for nested comments
}

export interface CreateCommentRequest {
  content: string;
  parentId?: string;
}

// Chat types
export interface Chat {
  id: string;
  type: ChatType;
  name?: string; // For group chats
  description?: string;
  participants: string[];
  admins: string[]; // For group chats
  lastMessage?: Message;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
}

export enum ChatType {
  DIRECT = 'direct',
  GROUP = 'group'
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
  user?: User; // Populated in responses
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  FILE = 'file',
  SYSTEM = 'system'
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
  // Connection management
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  
  // Post events
  POST_CREATED = 'post.created',
  POST_UPDATED = 'post.updated',
  POST_DELETED = 'post.deleted',
  POST_LIKED = 'post.liked',
  
  // Comment events
  COMMENT_ADDED = 'comment.added',
  COMMENT_UPDATED = 'comment.updated',
  COMMENT_DELETED = 'comment.deleted',
  
  // Chat events
  MESSAGE_SENT = 'message.sent',
  MESSAGE_READ = 'message.read',
  USER_TYPING = 'user.typing',
  
  // User events
  USER_ONLINE = 'user.online',
  USER_OFFLINE = 'user.offline',
  
  // System events
  NOTIFICATION = 'notification',
  ERROR = 'error'
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
  role: UserRole;
  permissions: string[];
}

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// Permission types
export enum Permission {
  // Post permissions
  CREATE_POST = 'post:create',
  UPDATE_OWN_POST = 'post:update:own',
  UPDATE_ANY_POST = 'post:update:any',
  DELETE_OWN_POST = 'post:delete:own',
  DELETE_ANY_POST = 'post:delete:any',
  
  // Comment permissions
  CREATE_COMMENT = 'comment:create',
  UPDATE_OWN_COMMENT = 'comment:update:own',
  UPDATE_ANY_COMMENT = 'comment:update:any',
  DELETE_OWN_COMMENT = 'comment:delete:own',
  DELETE_ANY_COMMENT = 'comment:delete:any',
  
  // Chat permissions
  CREATE_CHAT = 'chat:create',
  JOIN_CHAT = 'chat:join',
  SEND_MESSAGE = 'message:send',
  DELETE_OWN_MESSAGE = 'message:delete:own',
  DELETE_ANY_MESSAGE = 'message:delete:any',
  
  // Admin permissions
  MANAGE_USERS = 'user:manage',
  MODERATE_CONTENT = 'content:moderate',
  VIEW_ANALYTICS = 'analytics:view'
}

// Database types
export interface DynamoDBItem {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
  entityType: string;
  createdAt: string;
  updatedAt: string;
}

// File upload types
export interface FileUploadRequest {
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadType: 'profile' | 'post' | 'message';
}

export interface FileUploadResponse {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
}
