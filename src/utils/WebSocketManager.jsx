/**
 * WebSocketManager - A utility for managing WebSocket connections with automatic reconnection
 * and subscription handling for real-time price feeds.
 */
class WebSocketManager {
    constructor(url, options = {}) {
      this.url = url;
      this.options = {
        reconnectInterval: 2000,
        maxReconnectAttempts: 5,
        ...options
      };
      
      this.ws = null;
      this.reconnectAttempts = 0;
      this.subscriptions = new Map();
      this.isConnected = false;
      this.connectionPromise = null;
      this.messageHandlers = [];
      this.lastMessageId = 0;
    }
    
    /**
     * Connect to the WebSocket server
     * @returns {Promise} Resolves when connection is established
     */
    connect() {
      if (this.isConnected) {
        return Promise.resolve();
      }
      
      if (this.connectionPromise) {
        return this.connectionPromise;
      }
      
      this.connectionPromise = new Promise((resolve, reject) => {
        try {
          this.ws = new WebSocket(this.url);
          
          this.ws.onopen = () => {
            console.log('WebSocket connection established');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            resolve();
            
            // Resubscribe to all active subscriptions
            this.subscriptions.forEach((params, address) => {
              this.subscribe(address, params);
            });
          };
          
          this.ws.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              
              // Process subscription confirmations
              if (message.id && message.result) {
                const pendingSub = Array.from(this.subscriptions.values())
                  .find(sub => sub.pendingId === message.id);
                  
                if (pendingSub) {
                  pendingSub.id = message.result;
                  pendingSub.pendingId = null;
                }
              }
              
              // Notify all message handlers
              this.messageHandlers.forEach(handler => {
                try {
                  handler(message);
                } catch (handlerError) {
                  console.error('Error in message handler:', handlerError);
                }
              });
            } catch (parseError) {
              console.error('Error parsing WebSocket message:', parseError);
            }
          };
          
          this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (!this.isConnected) {
              reject(error);
            }
          };
          
          this.ws.onclose = () => {
            console.log('WebSocket connection closed');
            this.isConnected = false;
            this.connectionPromise = null;
            
            // Attempt to reconnect
            if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
              this.reconnectAttempts++;
              console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
              setTimeout(() => this.connect(), this.options.reconnectInterval);
            } else {
              console.error('Max reconnection attempts reached');
            }
          };
        } catch (error) {
          console.error('Error setting up WebSocket:', error);
          this.connectionPromise = null;
          reject(error);
        }
      });
      
      return this.connectionPromise;
    }
    
    /**
     * Subscribe to a specific account updates
     * @param {string} address - Account address to subscribe to
     * @param {Object} params - Subscription parameters
     * @returns {Promise} Resolves with subscription ID
     */
    async subscribe(address, params = { encoding: 'jsonParsed', commitment: 'confirmed' }) {
      await this.connect();
      
      const id = ++this.lastMessageId;
      
      const subscribeMsg = {
        jsonrpc: '2.0',
        id,
        method: 'accountSubscribe',
        params: [address, params]
      };
      
      // Store subscription information
      this.subscriptions.set(address, { 
        params, 
        pendingId: id,
        id: null 
      });
      
      this.ws.send(JSON.stringify(subscribeMsg));
      
      // Return the subscription ID once confirmed
      return new Promise((resolve) => {
        const checkSubscription = setInterval(() => {
          const sub = this.subscriptions.get(address);
          if (sub && sub.id) {
            clearInterval(checkSubscription);
            resolve(sub.id);
          }
        }, 100);
      });
    }
    
    /**
     * Unsubscribe from a specific account updates
     * @param {string} address - Account address to unsubscribe from
     */
    async unsubscribe(address) {
      if (!this.isConnected || !this.subscriptions.has(address)) {
        return;
      }
      
      const sub = this.subscriptions.get(address);
      if (!sub.id) return;
      
      const unsubscribeMsg = {
        jsonrpc: '2.0',
        id: ++this.lastMessageId,
        method: 'accountUnsubscribe',
        params: [sub.id]
      };
      
      this.ws.send(JSON.stringify(unsubscribeMsg));
      this.subscriptions.delete(address);
    }
    
    /**
     * Register a message handler function
     * @param {Function} handler - Function to handle incoming messages
     * @returns {Function} Function to remove the handler
     */
    onMessage(handler) {
      this.messageHandlers.push(handler);
      
      // Return a function to remove this handler
      return () => {
        const index = this.messageHandlers.indexOf(handler);
        if (index !== -1) {
          this.messageHandlers.splice(index, 1);
        }
      };
    }
    
    /**
     * Close the WebSocket connection
     */
    disconnect() {
      if (this.ws) {
        this.ws.close();
        this.isConnected = false;
        this.connectionPromise = null;
        this.subscriptions.clear();
      }
    }
    
    /**
     * Get connection status
     * @returns {boolean} Whether connection is active
     */
    getStatus() {
      return this.isConnected;
    }
  }
  
  export default WebSocketManager;