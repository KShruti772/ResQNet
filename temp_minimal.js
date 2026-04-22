// Offline queue management
const OFFLINE_QUEUE_KEY = 'offline_incidents_queue'

const saveToLocalQueue = (incidentData) => {
    try {
        const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
        const queuedIncident = {
            id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...incidentData,
            queuedAt: new Date().toISOString(),
            syncStatus: 'pending'
        }
        queue.push(queuedIncident)
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
        return queuedIncident.id
    } catch (error) {
        console.error('Failed to save incident to local queue:', error)
        throw error
    }
}

export const getQueuedIncidents = () => {
    try {
        return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
    } catch (error) {
        console.error('Failed to get queued incidents:', error)
        return []
    }
}

const removeFromQueue = (incidentId) => {
    try {
        const queue = getQueuedIncidents()
        const updatedQueue = queue.filter(item => item.id !== incidentId)
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue))
    } catch (error) {
        console.error('Failed to remove incident from queue:', error)
    }
}

export const syncQueuedIncidents = async () => {
    if (!navigator.onLine) return

    const queue = getQueuedIncidents()
    if (queue.length === 0) return

    console.log(`Syncing ${queue.length} queued incidents...`)

    for (const queuedIncident of queue) {
        try {
            // Create the incident in Firestore
            const docRef = await addDoc(collection(db, 'emergencies'), {
                ...queuedIncident,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            })

            // Update with AI metadata
            await updateIncidentWithAIFields(docRef.id, queuedIncident.title, queuedIncident.description)
                .catch((error) => console.warn('Background AI metadata update failed for synced incident', error))

            // Remove from queue
            removeFromQueue(queuedIncident.id)
            console.log(`Successfully synced incident: ${queuedIncident.title}`)
        } catch (error) {
            console.error(`Failed to sync incident ${queuedIncident.id}:`, error)
            // Keep in queue for next attempt
        }
    }
}

// Check online status
const isOnline = () => navigator.onLine

// Auto-sync when coming back online
let syncInterval = null

const startAutoSync = () => {
    if (syncInterval) return

    syncInterval = setInterval(() => {
        if (isOnline()) {
            syncQueuedIncidents()
        }
    }, 30000) // Check every 30 seconds
}

const stopAutoSync = () => {
    if (syncInterval) {
        clearInterval(syncInterval)
        syncInterval = null
    }
}

// Initialize auto-sync
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('Connection restored, syncing queued incidents...')
        syncQueuedIncidents()
    })

    startAutoSync()
}import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    onSnapshot,
    query,
    where,
    runTransaction,
    serverTimestamp,
    arrayUnion
} from 'firebase/firestore'
import { db } from '../firebase.js'
import {
    normalizeEmergencyStatus,
    normalizeOrganizationId
} from './emergencyUtils.js'
import { analyzeIncident } from '../../services/geminiService.js'
import { notifyIncidentCreated, notifyStaffAssigned, notifyEscalation, notifyCriticalAlert } from '../../services/notificationService.js';

export const LOCAL_ORGANIZATION_KEY = 'orgId'

export const storeOrganizationId = (organizationId) => {
    const normalizedOrganizationId = normalizeOrganizationId(organizationId || '')

    if (normalizedOrganizationId) {
        localStorage.setItem(LOCAL_ORGANIZATION_KEY, normalizedOrganizationId)
    } else {
        localStorage.removeItem(LOCAL_ORGANIZATION_KEY)
    }

    return normalizedOrganizationId
}

export const getStoredOrganizationId = () => {
    return localStorage.getItem(LOCAL_ORGANIZATION_KEY) || ''
}

export const getUserProfile = async (userId) => {
    if (!userId) {
        throw new Error('User ID is required to load profile')
    }

    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    const userData = userSnap.data()

    if (!userData) {
        throw new Error('User profile not found')
    }

    return userData
}

const buildLocationLabel = (location = {}) => {
    const building = String(location.building || '').trim()
    const floor = String(location.floor || '').trim()
    const room = String(location.room || '').trim()

    const parts = []
    if (room) parts.push(`Room ${room}`)
    if (floor) parts.push(`Floor ${floor}`)
    if (building) parts.push(`Building ${building}`)

    return parts.join(', ')
}

const getStaffCurrentFloor = (staffUser = {}) => {
    const currentLocation = staffUser.current_location || staffUser.currentLocation || {}
    return String(currentLocation.floor || '').trim().toLowerCase()
}

export const normalizeEmergencyRecord = (emergencyId, emergency = {}) => {
    const normalizedOrganizationId = normalizeOrganizationId(emergency.organizationId || '')
    const assignedStaffId = emergency.assignedStaffId || emergency.assignedTo || null
    const assignedStaffName = emergency.assignedStaffName || emergency.assignedToName || ''
    const normalizedStatus = normalizeEmergencyStatus(emergency.status)

    const rawLocation = emergency.location
    const locationDetails = rawLocation && typeof rawLocation === 'object'
        ? {
            building: String(rawLocation.building || '').trim(),
            floor: String(rawLocation.floor || '').trim(),
            room: String(rawLocation.room || '').trim()
        }
        : { building: '', floor: '', room: '' }

    const locationLabel = buildLocationLabel(locationDetails)
        || (typeof rawLocation === 'string' ? rawLocation : '')
        || (typeof emergency.latitude === 'number' && typeof emergency.longitude === 'number'
            ? `${emergency.latitude.toFixed(6)}, ${emergency.longitude.toFixed(6)}`
            : '')

    return {
        id: emergencyId,
        ...emergency,
        organizationId: normalizedOrganizationId,
    }
}