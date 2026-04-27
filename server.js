/**
 * Real-Time Socket.io Server
 * Bridges Firestore updates to connected clients via WebSockets
 * Fallback to polling if connection fails
 */

import http from 'http'
import express from 'express'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, onSnapshot, query, where } from 'firebase/firestore'

// Initialize Express app
const app = express()
const server = http.createServer(app)

// CORS configuration
app.use(cors())
app.use(express.json())

// Initialize Socket.io with CORS
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
})

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
}

let db = null

try {
  const firebaseApp = initializeApp(firebaseConfig)
  db = getFirestore(firebaseApp)
  console.log('✅ Firebase initialized')
} catch (error) {
  console.error('❌ Firebase initialization failed:', error)
}

// Store active connections and their subscriptions
const userSubscriptions = new Map() // { userId: Set of unsubscribe functions }
const orgSubscriptions = new Map() // { orgId: Set of unsubscribe functions }

/**
 * Subscribe to incident updates for a specific organization
 */
function subscribeToOrgIncidents(io, socket, organizationId) {
  if (!db) {
    console.warn('Firebase not initialized, cannot subscribe')
    return
  }

  try {
    const incidentsQuery = query(
      collection(db, 'emergencies'),
      where('organizationId', '==', organizationId)
    )

    const unsubscribe = onSnapshot(
      incidentsQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const incidentId = change.doc.id
          const incidentData = change.doc.data()

          if (change.type === 'added') {
            console.log(`📋 New incident: ${incidentId}`)
            socket.emit('incident_created', {
              id: incidentId,
              ...incidentData,
              timestamp: new Date().toISOString()
            })
            // Broadcast to all org members
            io.to(`org_${organizationId}`).emit('incident_created', {
              id: incidentId,
              ...incidentData,
              timestamp: new Date().toISOString()
            })
          }

          if (change.type === 'modified') {
            console.log(`✏️  Incident updated: ${incidentId}`)
            socket.emit('incident_updated', {
              id: incidentId,
              ...incidentData,
              timestamp: new Date().toISOString()
            })
            // Broadcast to all org members
            io.to(`org_${organizationId}`).emit('incident_updated', {
              id: incidentId,
              ...incidentData,
              timestamp: new Date().toISOString()
            })

            // Handle status-specific notifications
            if (incidentData.status === 'critical') {
              io.to(`org_${organizationId}`).emit('incident_escalated', {
                id: incidentId,
                type: 'critical',
                title: incidentData.title,
                priority: incidentData.priority,
                timestamp: new Date().toISOString()
              })
            }
          }

          if (change.type === 'removed') {
            console.log(`🗑️  Incident removed: ${incidentId}`)
            socket.emit('incident_removed', {
              id: incidentId,
              timestamp: new Date().toISOString()
            })
            io.to(`org_${organizationId}`).emit('incident_removed', {
              id: incidentId,
              timestamp: new Date().toISOString()
            })
          }
        })
      },
      (error) => {
        console.error(`❌ Incident subscription error for org ${organizationId}:`, error)
        socket.emit('subscription_error', {
          error: 'Failed to subscribe to incidents',
          code: error.code
        })
      }
    )

    // Store unsubscribe function
    if (!orgSubscriptions.has(organizationId)) {
      orgSubscriptions.set(organizationId, new Set())
    }
    orgSubscriptions.get(organizationId).add(unsubscribe)

    return unsubscribe
  } catch (error) {
    console.error('Error subscribing to org incidents:', error)
  }
}

/**
 * Subscribe to user-specific incident updates
 */
function subscribeToUserIncidents(io, socket, organizationId, userId) {
  if (!db) {
    console.warn('Firebase not initialized, cannot subscribe')
    return
  }

  try {
    const userIncidentsQuery = query(
      collection(db, 'emergencies'),
      where('organizationId', '==', organizationId),
      where('userId', '==', userId)
    )

    const unsubscribe = onSnapshot(
      userIncidentsQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const incidentData = change.doc.data()

          if (change.type === 'added' || change.type === 'modified') {
            socket.emit('user_incident_update', {
              id: change.doc.id,
              ...incidentData,
              timestamp: new Date().toISOString()
            })
          }
        })
      },
      (error) => {
        console.error(`Error in user incidents subscription:`, error)
      }
    )

    if (!userSubscriptions.has(userId)) {
      userSubscriptions.set(userId, new Set())
    }
    userSubscriptions.get(userId).add(unsubscribe)

    return unsubscribe
  } catch (error) {
    console.error('Error subscribing to user incidents:', error)
  }
}

/**
 * Socket.io connection handler
 */
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`)

  /**
   * Join organization room
   * Client emits: { organizationId, userId, role }
   */
  socket.on('join_organization', (data) => {
    const { organizationId, userId, role } = data

    if (!organizationId) {
      socket.emit('error', 'organizationId is required')
      return
    }

    // Join organization room
    socket.join(`org_${organizationId}`)
    console.log(`👤 User ${userId} joined org ${organizationId}`)

    // Subscribe to org incidents
    subscribeToOrgIncidents(io, socket, organizationId)

    // Subscribe to user incidents if user role is user/staff
    if (userId && (role === 'user' || role === 'staff' || role === 'admin')) {
      subscribeToUserIncidents(io, socket, organizationId, userId)
    }

    // Confirm subscription
    socket.emit('subscribed', {
      organizationId,
      userId,
      role,
      timestamp: new Date().toISOString()
    })
  })

  /**
   * Join role-specific room (staff, admin)
   * Client emits: { organizationId, role }
   */
  socket.on('join_role', (data) => {
    const { organizationId, role } = data

    if (!organizationId || !role) {
      socket.emit('error', 'organizationId and role are required')
      return
    }

    socket.join(`role_${organizationId}_${role}`)
    console.log(`🔐 User joined role: ${role}`)

    socket.emit('role_subscribed', {
      role,
      organizationId,
      timestamp: new Date().toISOString()
    })
  })

  /**
   * Manual incident update trigger (for testing)
   * Normally triggered by backend, but can be called for testing
   */
  socket.on('test_incident_created', (data) => {
    console.log('🧪 Test incident created event')
    const { organizationId } = data
    io.to(`org_${organizationId}`).emit('incident_created', {
      ...data,
      timestamp: new Date().toISOString()
    })
  })

  socket.on('test_incident_updated', (data) => {
    console.log('🧪 Test incident updated event')
    const { organizationId } = data
    io.to(`org_${organizationId}`).emit('incident_updated', {
      ...data,
      timestamp: new Date().toISOString()
    })
  })

  /**
   * Unsubscribe from organization
   */
  socket.on('leave_organization', (data) => {
    const { organizationId } = data
    socket.leave(`org_${organizationId}`)
    console.log(`👋 User left org ${organizationId}`)
  })

  /**
   * Ping/Pong for connection health check
   */
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() })
  })

  /**
   * Handle disconnect
   */
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`)
    // Subscriptions are automatically cleaned up when socket disconnects
  })

  /**
   * Error handler
   */
  socket.on('error', (error) => {
    console.error(`Socket error [${socket.id}]:`, error)
  })
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    firebase: db ? 'connected' : 'disconnected',
    connections: io.engine.clientsCount
  })
})

// Get active connections
app.get('/stats', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    activeConnections: io.engine.clientsCount,
    activeRooms: io.sockets.adapter.rooms.size,
    userSubscriptions: userSubscriptions.size,
    orgSubscriptions: orgSubscriptions.size
  })
})

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason)
})

// Start server
const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  🚀 Real-Time Socket Server Running    ║
║                                        ║
║  📡 WebSocket Server: ws://0.0.0.0    ║
║  🔌 Port: ${PORT}                       ║
║  🌐 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}║
║                                        ║
║  Health Check: http://localhost:${PORT}/health     ║
║  Stats: http://localhost:${PORT}/stats          ║
╚════════════════════════════════════════╝
  `)
})

export default io
