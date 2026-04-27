import {
    addDoc,
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    where
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { retryAsync, isOffline, queueOfflineRequest } from './retryService.js'

const LOG_COLLECTION = 'logs'
const DEFAULT_LOG_LIMIT = 50

const normalizeString = (value) => String(value || '').trim()

const normalizeErrorDetails = (error) => {
    if (!error) {
        return {
            message: 'Unknown error',
            code: null,
            stack: null
        }
    }

    return {
        message: normalizeString(error.message || error || 'Unknown error'),
        code: normalizeString(error.code || '') || null,
        stack: normalizeString(error.stack || '') || null
    }
}

const buildLogPayload = ({ action, level, message, userId, organizationId, metadata, context }) => ({
    action: normalizeString(action),
    level: normalizeString(level || 'activity'),
    message: normalizeString(message),
    userId: normalizeString(userId) || null,
    organizationId: normalizeString(organizationId) || null,
    metadata: metadata || {},
    context: context || {}
})

export const logActivity = async (action, details = {}) => {
    const payload = buildLogPayload({
        action,
        level: 'activity',
        message: details.message || `Activity recorded: ${action}`,
        userId: details.userId,
        organizationId: details.organizationId,
        metadata: details.metadata,
        context: details.context
    })

    if (isOffline()) {
        await queueOfflineRequest('logActivity', payload)
        return
    }

    try {
        await retryAsync(
            () => addDoc(collection(db, LOG_COLLECTION), {
                ...payload,
                timestamp: new Date()
            }),
            3,
            1000,
            { operationName: 'logActivity' }
        )
    } catch (error) {
        console.warn('[logService] logActivity failed, queuing for later sync', error)
        await queueOfflineRequest('logActivity', payload)
    }
}

export const logError = async (error, details = {}) => {
    const normalizedError = normalizeErrorDetails(error || details.error)
    const payload = buildLogPayload({
        action: details.action || 'ERROR',
        level: 'error',
        message: details.message || normalizedError.message,
        userId: details.userId,
        organizationId: details.organizationId,
        metadata: {
            ...details.metadata,
            error: normalizedError
        },
        context: details.context
    })

    if (isOffline()) {
        await queueOfflineRequest('logError', payload)
        return
    }

    try {
        await retryAsync(
            () => addDoc(collection(db, LOG_COLLECTION), {
                ...payload,
                timestamp: new Date()
            }),
            3,
            1000,
            { operationName: 'logError' }
        )
    } catch (logError) {
        console.warn('[logService] logError failed, queuing for later sync', logError)
        await queueOfflineRequest('logError', payload)
    }
}

export const getRecentLogs = async (organizationId, limitCount = DEFAULT_LOG_LIMIT) => {
    const normalizedOrganizationId = normalizeString(organizationId)
    if (!normalizedOrganizationId) {
        return []
    }

    const logsQuery = query(
        collection(db, LOG_COLLECTION),
        where('organizationId', '==', normalizedOrganizationId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
    )

    const snapshot = await getDocs(logsQuery)
    return snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
    }))
}
