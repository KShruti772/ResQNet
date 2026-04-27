/**
 * Socket.io Client Service
 * Manages real-time connections and event handling
 * Provides fallback to polling if connection fails
 */

import { io } from 'socket.io-client'

class SocketService {
  constructor() {
    this.socket = null
    this.isConnected = false
    this.connectionAttempts = 0
    this.maxConnectionAttempts = 5
    this.listeners = new Map() // Store event listeners
    this.pollIntervals = new Map() // Store polling intervals for fallback
  }

  /**
   * Initialize socket connection
   * @param {string} serverUrl - Backend server URL
   * @param {Object} options - Socket.io options
   */
  connect(serverUrl = 'http://localhost:3001', options = {}) {
    if (this.socket?.connected) {
      console.warn('⚠️ Socket already connected')
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      try {
        this.socket = io(serverUrl, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: this.maxConnectionAttempts,
          transports: ['websocket', 'polling'],
          ...options
        })

        // Connection success
        this.socket.on('connect', () => {
          this.isConnected = true
          this.connectionAttempts = 0
          console.log('✅ Socket connected:', this.socket.id)
          resolve()
        })

        // Connection error
        this.socket.on('connect_error', (error) => {
          this.connectionAttempts++
          console.warn(`⚠️ Socket connection error (attempt ${this.connectionAttempts}):`, error)

          if (this.connectionAttempts >= this.maxConnectionAttempts) {
            console.error('❌ Max connection attempts reached, using polling fallback')
            this.enablePollingFallback()
            reject(error)
          }
        })

        // Disconnection
        this.socket.on('disconnect', () => {
          this.isConnected = false
          console.log('❌ Socket disconnected, attempting to reconnect...')
        })

        // Subscription errors
        this.socket.on('subscription_error', (data) => {
          console.error('❌ Subscription error:', data)
          // Trigger fallback to polling
          this.enablePollingFallback()
        })

        // Health check (respond to ping)
        this.socket.on('ping', () => {
          this.socket.emit('pong')
        })

      } catch (error) {
        console.error('❌ Socket initialization error:', error)
        this.enablePollingFallback()
        reject(error)
      }
    })
  }

  /**
   * Join organization room and subscribe to updates
   * @param {string} organizationId - Organization ID
   * @param {string} userId - User ID
   * @param {string} role - User role (user, staff, admin)
   */
  joinOrganization(organizationId, userId, role) {
    if (!this.isConnected) {
      console.warn('⚠️ Socket not connected, storing join request for retry')
      this.pendingJoin = { organizationId, userId, role }
      return
    }

    this.socket.emit('join_organization', {
      organizationId,
      userId,
      role,
      timestamp: new Date().toISOString()
    })

    console.log(`✅ Joined organization: ${organizationId}`)
  }

  /**
   * Join role-specific room
   * @param {string} organizationId - Organization ID
   * @param {string} role - User role
   */
  joinRole(organizationId, role) {
    if (!this.isConnected) {
      console.warn('⚠️ Socket not connected')
      return
    }

    this.socket.emit('join_role', {
      organizationId,
      role,
      timestamp: new Date().toISOString()
    })

    console.log(`✅ Joined role room: ${role}`)
  }

  /**
   * Listen for incident creation events
   * @param {Function} callback - Callback function
   */
  onIncidentCreated(callback) {
    if (this.socket) {
      this.socket.on('incident_created', callback)
      this.listeners.set('incident_created', callback)
    }
  }

  /**
   * Listen for incident updates
   * @param {Function} callback - Callback function
   */
  onIncidentUpdated(callback) {
    if (this.socket) {
      this.socket.on('incident_updated', callback)
      this.listeners.set('incident_updated', callback)
    }
  }

  /**
   * Listen for incident assignment
   * @param {Function} callback - Callback function
   */
  onIncidentAssigned(callback) {
    if (this.socket) {
      this.socket.on('incident_assigned', callback)
      this.listeners.set('incident_assigned', callback)
    }
  }

  /**
   * Listen for incident escalation
   * @param {Function} callback - Callback function
   */
  onIncidentEscalated(callback) {
    if (this.socket) {
      this.socket.on('incident_escalated', callback)
      this.listeners.set('incident_escalated', callback)
    }
  }

  /**
   * Listen for user incident updates
   * @param {Function} callback - Callback function
   */
  onUserIncidentUpdate(callback) {
    if (this.socket) {
      this.socket.on('user_incident_update', callback)
      this.listeners.set('user_incident_update', callback)
    }
  }

  /**
   * Listen for subscription confirmation
   * @param {Function} callback - Callback function
   */
  onSubscribed(callback) {
    if (this.socket) {
      this.socket.on('subscribed', callback)
      this.listeners.set('subscribed', callback)
    }
  }

  /**
   * Listen for custom events
   * @param {string} eventName - Event name
   * @param {Function} callback - Callback function
   */
  on(eventName, callback) {
    if (this.socket) {
      this.socket.on(eventName, callback)
      this.listeners.set(eventName, callback)
    }
  }

  /**
   * Remove event listener
   * @param {string} eventName - Event name
   */
  off(eventName) {
    if (this.socket) {
      this.socket.off(eventName)
      this.listeners.delete(eventName)
    }
  }

  /**
   * Enable polling fallback (if WebSocket fails)
   * This is called automatically on connection failure
   */
  enablePollingFallback() {
    console.log('🔄 Enabling polling fallback...')
    this.isConnected = false

    // Polling will be implemented at component level using onSnapshot
    // This is a marker that socket failed
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.isConnected = false
      console.log('✅ Socket disconnected')
    }

    // Clear polling intervals
    this.pollIntervals.forEach((interval) => clearInterval(interval))
    this.pollIntervals.clear()
  }

  /**
   * Check if socket is connected
   */
  isConnectedStatus() {
    return this.isConnected && this.socket?.connected
  }

  /**
   * Get socket instance
   */
  getSocket() {
    return this.socket
  }

  /**
   * Test connection with ping
   */
  ping() {
    if (this.isConnected) {
      this.socket.emit('ping')
      return true
    }
    return false
  }
}

// Export singleton instance
export const socketService = new SocketService()
