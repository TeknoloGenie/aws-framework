import { io, Socket } from 'socket.io-client';
import { WebSocketMessage, WebSocketMessageType } from '../types';
import { AuthService } from './auth';

export class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  async connect(): Promise<boolean> {
    try {
      const user = await AuthService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL!;
      
      this.socket = io(wsUrl, {
        auth: {
          token: user.accessToken
        },
        transports: ['websocket'],
        upgrade: false,
        rememberUpgrade: false
      });

      return new Promise((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Socket not initialized'));
          return;
        }

        this.socket.on('connect', () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.setupEventHandlers();
          resolve(true);
        });

        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected:', reason);
          if (reason === 'io server disconnect') {
            // Server disconnected, try to reconnect
            this.handleReconnect();
          }
        });
      });
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      return false;
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Handle incoming messages
    this.socket.on('message', (message: WebSocketMessage) => {
      this.handleMessage(message);
    });

    // Handle specific event types
    Object.values(WebSocketMessageType).forEach(eventType => {
      this.socket!.on(eventType, (data: any) => {
        this.notifyListeners(eventType, data);
      });
    });
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('Received WebSocket message:', message);
    this.notifyListeners(message.type, message.data);
  }

  private notifyListeners(eventType: string, data: any): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket listener:', error);
        }
      });
    }
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.handleReconnect();
      }
    }, delay);
  }

  // Event subscription methods
  on(eventType: WebSocketMessageType | string, callback: (data: any) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
  }

  off(eventType: WebSocketMessageType | string, callback: (data: any) => void): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  // Send messages
  sendMessage(type: WebSocketMessageType, data: any): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('WebSocket not connected, cannot send message');
      return;
    }

    const message: WebSocketMessage = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    this.socket.emit('message', message);
  }

  // Typing indicators
  sendTyping(chatId: string, isTyping: boolean): void {
    this.sendMessage(WebSocketMessageType.USER_TYPING, {
      chatId,
      isTyping
    });
  }

  // Message read receipts
  markMessageAsRead(messageId: string, chatId: string): void {
    this.sendMessage(WebSocketMessageType.MESSAGE_READ, {
      messageId,
      chatId
    });
  }

  // Connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Get connection ID (if needed)
  getConnectionId(): string | null {
    return this.socket?.id || null;
  }
}

// Singleton instance
export const webSocketService = new WebSocketService();

// React hook for WebSocket
import { useEffect, useRef, useState } from 'react';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const serviceRef = useRef(webSocketService);

  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        const connected = await serviceRef.current.connect();
        setIsConnected(connected);
        setConnectionError(null);
      } catch (error: any) {
        setConnectionError(error.message);
        setIsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      serviceRef.current.disconnect();
      setIsConnected(false);
    };
  }, []);

  const subscribe = (eventType: WebSocketMessageType | string, callback: (data: any) => void) => {
    serviceRef.current.on(eventType, callback);
    
    return () => {
      serviceRef.current.off(eventType, callback);
    };
  };

  const sendMessage = (type: WebSocketMessageType, data: any) => {
    serviceRef.current.sendMessage(type, data);
  };

  const sendTyping = (chatId: string, isTyping: boolean) => {
    serviceRef.current.sendTyping(chatId, isTyping);
  };

  const markMessageAsRead = (messageId: string, chatId: string) => {
    serviceRef.current.markMessageAsRead(messageId, chatId);
  };

  return {
    isConnected,
    connectionError,
    subscribe,
    sendMessage,
    sendTyping,
    markMessageAsRead
  };
}

// Hook for specific event types
export function useWebSocketEvent(
  eventType: WebSocketMessageType | string,
  callback: (data: any) => void,
  deps: any[] = []
) {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe(eventType, callback);
    return unsubscribe;
  }, [eventType, subscribe, ...deps]);
}
