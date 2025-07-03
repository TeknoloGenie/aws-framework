import { UserRole, Permission, AuthUser } from '../types';

// Role-based permission mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // All permissions
    Permission.CREATE_POST,
    Permission.UPDATE_OWN_POST,
    Permission.UPDATE_ANY_POST,
    Permission.DELETE_OWN_POST,
    Permission.DELETE_ANY_POST,
    Permission.CREATE_COMMENT,
    Permission.UPDATE_OWN_COMMENT,
    Permission.UPDATE_ANY_COMMENT,
    Permission.DELETE_OWN_COMMENT,
    Permission.DELETE_ANY_COMMENT,
    Permission.CREATE_CHAT,
    Permission.JOIN_CHAT,
    Permission.SEND_MESSAGE,
    Permission.DELETE_OWN_MESSAGE,
    Permission.DELETE_ANY_MESSAGE,
    Permission.MANAGE_USERS,
    Permission.MODERATE_CONTENT,
    Permission.VIEW_ANALYTICS
  ],
  
  [UserRole.MODERATOR]: [
    // Content moderation permissions
    Permission.CREATE_POST,
    Permission.UPDATE_OWN_POST,
    Permission.UPDATE_ANY_POST,
    Permission.DELETE_OWN_POST,
    Permission.DELETE_ANY_POST,
    Permission.CREATE_COMMENT,
    Permission.UPDATE_OWN_COMMENT,
    Permission.UPDATE_ANY_COMMENT,
    Permission.DELETE_OWN_COMMENT,
    Permission.DELETE_ANY_COMMENT,
    Permission.CREATE_CHAT,
    Permission.JOIN_CHAT,
    Permission.SEND_MESSAGE,
    Permission.DELETE_OWN_MESSAGE,
    Permission.DELETE_ANY_MESSAGE,
    Permission.MODERATE_CONTENT
  ],
  
  [UserRole.USER]: [
    // Basic user permissions
    Permission.CREATE_POST,
    Permission.UPDATE_OWN_POST,
    Permission.DELETE_OWN_POST,
    Permission.CREATE_COMMENT,
    Permission.UPDATE_OWN_COMMENT,
    Permission.DELETE_OWN_COMMENT,
    Permission.CREATE_CHAT,
    Permission.JOIN_CHAT,
    Permission.SEND_MESSAGE,
    Permission.DELETE_OWN_MESSAGE
  ]
};

export class PermissionManager {
  /**
   * Get all permissions for a user role
   */
  static getPermissionsForRole(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Check if a user has a specific permission
   */
  static hasPermission(user: AuthUser, permission: Permission): boolean {
    const rolePermissions = this.getPermissionsForRole(user.role);
    return rolePermissions.includes(permission) || user.permissions.includes(permission);
  }

  /**
   * Check if a user can perform an action on a resource they own
   */
  static canPerformOnOwnResource(
    user: AuthUser, 
    resourceOwnerId: string, 
    ownPermission: Permission, 
    anyPermission?: Permission
  ): boolean {
    // Check if user owns the resource and has own permission
    if (user.id === resourceOwnerId && this.hasPermission(user, ownPermission)) {
      return true;
    }
    
    // Check if user has permission to act on any resource
    if (anyPermission && this.hasPermission(user, anyPermission)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if user can update a post
   */
  static canUpdatePost(user: AuthUser, postOwnerId: string): boolean {
    return this.canPerformOnOwnResource(
      user,
      postOwnerId,
      Permission.UPDATE_OWN_POST,
      Permission.UPDATE_ANY_POST
    );
  }

  /**
   * Check if user can delete a post
   */
  static canDeletePost(user: AuthUser, postOwnerId: string): boolean {
    return this.canPerformOnOwnResource(
      user,
      postOwnerId,
      Permission.DELETE_OWN_POST,
      Permission.DELETE_ANY_POST
    );
  }

  /**
   * Check if user can update a comment
   */
  static canUpdateComment(user: AuthUser, commentOwnerId: string): boolean {
    return this.canPerformOnOwnResource(
      user,
      commentOwnerId,
      Permission.UPDATE_OWN_COMMENT,
      Permission.UPDATE_ANY_COMMENT
    );
  }

  /**
   * Check if user can delete a comment
   */
  static canDeleteComment(user: AuthUser, commentOwnerId: string): boolean {
    return this.canPerformOnOwnResource(
      user,
      commentOwnerId,
      Permission.DELETE_OWN_COMMENT,
      Permission.DELETE_ANY_COMMENT
    );
  }

  /**
   * Check if user can delete a message
   */
  static canDeleteMessage(user: AuthUser, messageOwnerId: string): boolean {
    return this.canPerformOnOwnResource(
      user,
      messageOwnerId,
      Permission.DELETE_OWN_MESSAGE,
      Permission.DELETE_ANY_MESSAGE
    );
  }

  /**
   * Check if user can join a chat
   */
  static canJoinChat(user: AuthUser, chatParticipants: string[]): boolean {
    // Users can join if they have permission and are invited (in participants list)
    return this.hasPermission(user, Permission.JOIN_CHAT) && 
           chatParticipants.includes(user.id);
  }

  /**
   * Check if user can manage a group chat
   */
  static canManageGroupChat(user: AuthUser, chatAdmins: string[]): boolean {
    // Chat admins or users with manage permissions can manage group chats
    return chatAdmins.includes(user.id) || 
           this.hasPermission(user, Permission.MANAGE_USERS);
  }

  /**
   * Get user permissions as array for JWT token
   */
  static getUserPermissions(role: UserRole, additionalPermissions: string[] = []): string[] {
    const rolePermissions = this.getPermissionsForRole(role);
    const allPermissions = [...rolePermissions, ...additionalPermissions];
    return Array.from(new Set(allPermissions)); // Remove duplicates
  }

  /**
   * Validate if user has required permissions for WebSocket connection
   */
  static canConnectToWebSocket(user: AuthUser): boolean {
    // All authenticated users can connect to WebSocket
    return true;
  }

  /**
   * Check if user can receive WebSocket messages for a specific entity
   */
  static canReceiveWebSocketMessage(
    user: AuthUser, 
    messageType: string, 
    entityOwnerId?: string,
    chatParticipants?: string[]
  ): boolean {
    switch (messageType) {
      case 'post.created':
      case 'post.updated':
      case 'post.deleted':
        // Users can receive post updates if they follow the user or it's public
        return true; // Implement following logic as needed
        
      case 'comment.added':
      case 'comment.updated':
      case 'comment.deleted':
        // Users can receive comment updates on posts they can see
        return true;
        
      case 'message.sent':
      case 'message.read':
        // Users can receive message updates only for chats they're part of
        return chatParticipants ? chatParticipants.includes(user.id) : false;
        
      case 'user.online':
      case 'user.offline':
        // Users can receive status updates for users they interact with
        return true;
        
      default:
        return false;
    }
  }
}
