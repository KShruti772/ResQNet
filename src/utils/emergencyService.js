import {
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
import {
    notifyIncidentCreated,
    notifyStaffAssigned,
    notifyEscalation,
    notifyCriticalAlert
} from '../../services/notificationService.js'
import {
    retryAsync,
    isOffline,
    queueOfflineRequest,
    syncQueuedRequests,
    getQueuedRequestCount,
    subscribeOnlineSync
} from './retryService.js'
import {
    logActivity,
    logError
} from './logService.js'
import { getBestStaff, getFallbackStaff } from '../services/assignmentService.js'
import {
    validateIncident,
    validateStatusUpdate,
    sanitizeUserInput
} from './validationService.js'
import { rateLimiter } from './rateLimitService.js'
import { analyzeIncident, detectIncidentPatterns } from '../../services/geminiService.js'

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

/**
 * Detect incident patterns by analyzing recent incidents from same location and type
 * @param {string} organizationId - Organization ID
 * @param {Object} location - Incident location (building, floor, room)
 * @param {string} incidentType - AI-detected incident type
 * @returns {Promise<Object>} Pattern detection results
 */
const detectPatternsForIncident = async (organizationId, location, incidentType) => {
    try {
        // Query recent incidents from same organization (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000))

        const incidentsQuery = query(
            collection(db, 'emergencies'),
            where('organizationId', '==', organizationId),
            where('createdAt', '>', thirtyDaysAgo)
        )

        const incidentsSnapshot = await getDocs(incidentsQuery)
        const recentIncidents = incidentsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt // Keep Firestore timestamp
        }))

        // Create current incident object for pattern detection
        const currentIncident = {
            location,
            type: incidentType
        }

        // Use the pattern detection service
        const patternResult = detectIncidentPatterns(recentIncidents, currentIncident)

        console.log(`Pattern analysis for org ${organizationId}:`, {
            totalRecentIncidents: recentIncidents.length,
            patternResult
        })

        return patternResult

    } catch (error) {
        console.error('Pattern detection failed:', error)
        // Return safe fallback
        return {
            pattern_detected: false,
            frequency_score: 0,
            note: null
        }
    }
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

const getNotificationAdminEmail = (user = {}) => {
    return String(import.meta.env.VITE_NOTIFICATION_ADMIN_EMAIL || user.email || '').trim()
}

const fetchOrganizationStaffEmails = async (organizationId) => {
    if (!organizationId) {
        return []
    }

    const staffQuery = query(
        collection(db, 'users'),
        where('organizationId', '==', organizationId),
        where('role', '==', 'staff')
    )

    const snapshot = await getDocs(staffQuery)
    return snapshot.docs
        .map((docSnapshot) => String(docSnapshot.data()?.email || '').trim())
        .filter(Boolean)
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
        status: normalizedStatus,
        title: emergency.title || emergency.emergencyType || 'Untitled Incident',
        assignedStaffId,
        assignedStaffName,
        assignedTo: assignedStaffId,
        type: String(emergency.type || emergency.emergencyType || 'general').trim().toLowerCase(),
        priority: String(emergency.priority || 'medium').trim().toLowerCase(),
        summary: String(emergency.summary || emergency.description || '').trim(),
        sla_limit: Number(emergency.sla_limit ?? emergency.slaLimit ?? 0) || 0,
        risk_flag: Boolean(emergency.risk_flag ?? emergency.riskFlag ?? false),
        escalation_level: Number(emergency.escalation_level ?? emergency.escalationLevel ?? 0) || 0,
        previousAssignedStaffIds: Array.isArray(emergency.previousAssignedStaffIds)
            ? emergency.previousAssignedStaffIds
            : [],
        location: locationLabel,
        locationDetails,
        locationLabel,
        is_critical: Boolean(emergency.is_critical ?? false)
    }
}

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

const parseIncidentAIResponse = (responseText = '') => {
    try {
        const parsed = JSON.parse(responseText)

        return {
            type: String(parsed.type || 'general').trim().toLowerCase(),
            priority: String(parsed.priority || 'medium').trim().toLowerCase(),
            summary: String(parsed.summary || '').trim() || responseText.trim()
        }
    } catch (error) {
        console.warn('Failed to parse AI incident response', error)
        return {
            type: 'general',
            priority: 'medium',
            summary: responseText.trim() || ''
        }
    }
}

const getSLALimitFromPriority = (priority = 'medium') => {
    const normalized = String(priority || 'medium').trim().toLowerCase()
    if (normalized === 'high') return 120
    if (normalized === 'low') return 600
    return 300
}

const getRecommendations = (type = 'general') => {
    const normalizedType = String(type || 'general').trim().toLowerCase()

    const recommendations = {
        'fire': [
            'Check nearest fire extinguisher',
            'Evacuate nearby area',
            'Call fire safety team'
        ],
        'medical': [
            'Call medical team immediately',
            'Provide first aid if trained',
            'Stay with the person'
        ],
        'security': [
            'Alert security personnel',
            'Restrict access to area',
            'Monitor situation'
        ],
        'general': [
            'Assess the situation',
            'Notify appropriate team'
        ]
    }

    return recommendations[normalizedType] || recommendations['general']
}

const addEvent = async (incidentId, eventType, performedBy) => {
    const incidentRef = doc(db, 'emergencies', incidentId)
    const newEvent = {
        event_type: String(eventType || '').trim().toUpperCase(),
        performed_by: String(performedBy || '').trim(),
        timestamp: new Date()
    }

    await updateDoc(incidentRef, {
        events: arrayUnion(newEvent)
    })
}

export const checkSLARisk = async (incidentId) => {
    const incidentRef = doc(db, 'emergencies', incidentId)

    await runTransaction(db, async (transaction) => {
        const incidentSnap = await transaction.get(incidentRef)
        if (!incidentSnap.exists()) {
            return
        }

        const emergency = normalizeEmergencyRecord(incidentSnap.id, incidentSnap.data())
        if (emergency.risk_flag) {
            return
        }

        if (['accepted', 'resolved', 'critical'].includes(emergency.status)) {
            return
        }

        const createdAt = emergency.createdAt
        const slaLimit = Number(emergency.sla_limit || emergency.slaLimit || 0)

        if (!createdAt || !slaLimit) {
            return
        }

        const createdMillis = createdAt.seconds ? createdAt.seconds * 1000 : createdAt
        const elapsedSeconds = Math.max(0, Date.now() - createdMillis) / 1000

        if (elapsedSeconds >= slaLimit * 0.7) {
            transaction.update(incidentRef, {
                risk_flag: true,
                updatedAt: new Date()
            })
        }

        // Check if SLA is breached (full limit exceeded)
        if (elapsedSeconds >= slaLimit) {
            await checkCriticalStatus(incidentId)
        }
    })
}

const fetchIncidentAIAnalysis = async (title, description) => {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured')
    }

    const prompt = `Extract the following details from the emergency message:

1. Emergency Type (medical, fire, security, other)
2. Priority (low, medium, high)
3. Short Summary (1 sentence)

Return ONLY valid JSON:
{
  "type": "",
  "priority": "",
  "summary": ""
}`

    const body = {
        model: 'gpt-3.5-turbo',
        messages: [
            {
                role: 'system',
                content: 'You are a strict JSON generator for emergency incident extraction.'
            },
            {
                role: 'user',
                content: `${prompt}\n\nEmergency Title: ${title}\nEmergency Description: ${description}`
            }
        ],
        max_tokens: 200,
        temperature: 0.0
    }

    const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify(body)
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI request failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const aiText = data?.choices?.[0]?.message?.content || ''
    return parseIncidentAIResponse(aiText)
}

const updateIncidentWithAIFields = async (incidentId, title, description) => {
    try {
        const aiData = await fetchIncidentAIAnalysis(title, description)
        const newType = aiData.type || 'general'
        const newPriority = aiData.priority || 'medium'
        await updateDoc(doc(db, 'emergencies', incidentId), {
            type: newType,
            priority: newPriority,
            summary: aiData.summary || description,
            sla_limit: getSLALimitFromPriority(newPriority),
            recommendations: getRecommendations(newType),
            updatedAt: serverTimestamp()
        })
    } catch (error) {
        console.warn('Incident AI summary failed; using fallback values', error)
        await updateDoc(doc(db, 'emergencies', incidentId), {
            type: 'general',
            priority: 'medium',
            summary: description,
            sla_limit: getSLALimitFromPriority('medium'),
            recommendations: getRecommendations('general'),
            updatedAt: serverTimestamp()
        })
    }
}

const isStaffAvailable = (staffUser = {}) => {
    const availability = String(staffUser.availability_status || staffUser.availabilityStatus || '').trim().toLowerCase()
    return !availability || availability === 'available'
}

const getStaffLoad = (staffUser = {}) => {
    return Number(staffUser.active_incidents_count ?? staffUser.activeIncidentsCount ?? 0) || 0
}

const selectBestAvailableStaff = (staffUsers = [], incidentLocation = {}) => {
    const targetFloor = String(incidentLocation?.floor || '').trim().toLowerCase()

    return [...staffUsers]
        .filter(isStaffAvailable)
        .sort((a, b) => {
            const aMatchesFloor = targetFloor && getStaffCurrentFloor(a) === targetFloor ? 0 : 1
            const bMatchesFloor = targetFloor && getStaffCurrentFloor(b) === targetFloor ? 0 : 1

            if (aMatchesFloor !== bMatchesFloor) {
                return aMatchesFloor - bMatchesFloor
            }

            const countA = getStaffLoad(a)
            const countB = getStaffLoad(b)

            if (countA !== countB) {
                return countA - countB
            }

            return String(a.uid || a.id || '').localeCompare(String(b.uid || b.id || ''))
        })[0] || null
}

const MAX_ESCALATION_LEVEL = 3

const scheduleIncidentEscalation = (incidentId, delayMs = 30000) => {
    setTimeout(async () => {
        try {
            await checkSLARisk(incidentId)
            await handleIncidentEscalation(incidentId)
        } catch (error) {
            console.warn('Escalation or SLA check failed for incident', incidentId, error)
        }
    }, delayMs)
}

export const handleIncidentEscalation = async (incidentId) => {
    const incidentRef = doc(db, 'emergencies', incidentId)
    let shouldScheduleNextEscalation = false
    let shouldNotifyCritical = false
    let shouldNotifyEscalation = false
    let escalatedStaff = null
    let staffEmails = []

    await runTransaction(db, async (transaction) => {
        const incidentSnap = await transaction.get(incidentRef)
        if (!incidentSnap.exists()) {
            return
        }

        const emergency = normalizeEmergencyRecord(incidentSnap.id, incidentSnap.data())
        if (emergency.status === 'accepted' || emergency.status === 'resolved' || emergency.status === 'critical') {
            return
        }

        const currentLevel = Number(emergency.escalation_level || 0)
        const nextLevel = currentLevel + 1
        const nextIsCritical = nextLevel >= MAX_ESCALATION_LEVEL
        const excludedStaffIds = new Set([...(emergency.previousAssignedStaffIds || []), emergency.assignedStaffId].filter(Boolean))

        const staffQuery = query(
            collection(db, 'users'),
            where('organizationId', '==', emergency.organizationId),
            where('role', '==', 'staff')
        )

        const staffSnapshot = await getDocs(staffQuery)
        const staffUsers = staffSnapshot.docs.map((docSnapshot) => ({ uid: docSnapshot.id, ...docSnapshot.data() }))
        staffEmails = staffUsers.map((staffUser) => String(staffUser.email || '').trim()).filter(Boolean)
        const availableNextStaff = staffUsers
            .filter(isStaffAvailable)
            .filter((staffUser) => !excludedStaffIds.has(staffUser.uid))

        const updateData = {
            escalation_level: nextLevel,
            updatedAt: new Date()
        }

        if (nextIsCritical) {
            updateData.status = 'critical'
            updateData.is_critical = true
            updateData.events = arrayUnion({
                event_type: 'CRITICAL',
                performed_by: 'system',
                timestamp: new Date()
            })
            transaction.update(incidentRef, updateData)
            shouldNotifyCritical = true
            console.warn('Escalation max reached; incident marked critical', incidentId)
            return
        }

        if (availableNextStaff.length === 0) {
            updateData.status = 'escalated'
            transaction.update(incidentRef, updateData)
            shouldScheduleNextEscalation = true
            console.warn('No alternate staff available for escalation', incidentId)
            return
        }

        // Use smart assignment for escalation
        const escalationIncident = {
            id: incidentId,
            organizationId: emergency.organizationId,
            emergencyType: emergency.emergencyType || emergency.type,
            locationDetails: emergency.locationDetails || {}
        }

        let nextStaff = await getBestStaff(escalationIncident)

        // Fallback to location-based if smart assignment fails
        if (!nextStaff) {
            console.log('Smart assignment failed for escalation, using fallback')
            nextStaff = getFallbackStaff(availableNextStaff, emergency.locationDetails || {})
        }

        if (!nextStaff) {
            updateData.status = 'escalated'
            transaction.update(incidentRef, updateData)
            shouldScheduleNextEscalation = true
            console.warn('No suitable staff found for escalation', incidentId)
            return
        }

        const previousStaffRef = emergency.assignedStaffId ? doc(db, 'users', emergency.assignedStaffId) : null
        const nextStaffRef = doc(db, 'users', nextStaff.uid)

        const previousStaffCount = previousStaffRef
            ? getStaffLoad((await transaction.get(previousStaffRef)).data())
            : 0
        const nextStaffCount = getStaffLoad((await transaction.get(nextStaffRef)).data())

        if (previousStaffRef) {
            transaction.update(previousStaffRef, {
                active_incidents_count: Math.max(0, previousStaffCount - 1)
            })
        }

        transaction.update(nextStaffRef, {
            active_incidents_count: nextStaffCount + 1
        })

        updateData.status = 'assigned'
        updateData.assignedStaffId = nextStaff.uid
        updateData.assignedStaffName = nextStaff.fullName || nextStaff.displayName || 'Staff Member'
        updateData.previousAssignedStaffIds = Array.from(excludedStaffIds)
        updateData.events = arrayUnion({
            event_type: 'ESCALATED',
            performed_by: 'system',
            timestamp: new Date()
        })

        transaction.update(incidentRef, updateData)
        shouldScheduleNextEscalation = true
        shouldNotifyEscalation = true
        escalatedStaff = nextStaff
    })

    if (shouldScheduleNextEscalation) {
        scheduleIncidentEscalation(incidentId)
    }

    if (shouldNotifyCritical) {
        try {
            const updatedIncidentSnap = await getDoc(incidentRef)
            const updatedEmergency = normalizeEmergencyRecord(incidentRef.id, updatedIncidentSnap.data() || {})
            const adminEmail = getNotificationAdminEmail()

            notifyCriticalAlert(updatedEmergency, adminEmail, staffEmails)
                .catch((error) => console.warn('Critical alert notification failed', error))
        } catch (error) {
            console.warn('Failed to load critical incident for notifications', error)
        }
    } else if (shouldNotifyEscalation && escalatedStaff) {
        try {
            const updatedIncidentSnap = await getDoc(incidentRef)
            const updatedEmergency = normalizeEmergencyRecord(incidentRef.id, updatedIncidentSnap.data() || {})
            const adminEmail = getNotificationAdminEmail()
            const nextStaffEmail = escalatedStaff.email || escalatedStaff.contactEmail || ''
            const nextStaffPhone = escalatedStaff.phone || escalatedStaff.phoneNumber || ''

            notifyEscalation(updatedEmergency, adminEmail, nextStaffEmail, nextStaffPhone)
                .catch((error) => console.warn('Escalation notification failed', error))
        } catch (error) {
            console.warn('Failed to load escalated incident for notifications', error)
        }
    }
}

const sortEmergenciesByCreatedAt = (emergencies = []) => {
    return [...emergencies].sort((left, right) => {
        const leftCreatedAt = left.createdAt?.seconds
            ? left.createdAt.seconds * 1000
            : left.createdAt instanceof Date
                ? left.createdAt.getTime()
                : left.createdAt || 0

        const rightCreatedAt = right.createdAt?.seconds
            ? right.createdAt.seconds * 1000
            : right.createdAt instanceof Date
                ? right.createdAt.getTime()
                : right.createdAt || 0

        return rightCreatedAt - leftCreatedAt
    })
}

const performCreateEmergency = async ({ user, title, emergencyType, description, latitude, longitude, location }) => {
    // Security: Validate user authentication
    if (!user || !user.uid) {
        throw new Error('User must be authenticated to create an emergency')
    }

    // Security: Check rate limit
    const rateLimitCheck = rateLimiter.isIncidentCreationAllowed(user.uid)
    if (!rateLimitCheck.allowed) {
        const error = new Error('Too many incidents created recently')
        error.code = 'RATE_LIMITED'
        error.retryAfter = rateLimitCheck.retryAfter
        throw error
    }

    // Security: Validate organization
    const organizationId = normalizeOrganizationId(user.organizationId || '')
    if (!organizationId) {
        throw new Error('Organization ID is required to create an emergency')
    }

    // Security: Sanitize and validate inputs
    const normalizedTitle = sanitizeUserInput(String(title || emergencyType || 'Untitled Incident').trim())
    const sanitizedDescription = sanitizeUserInput(String(description || '').trim())

    const incidentLocation = {
        building: sanitizeUserInput(String(location?.building || '').trim()),
        floor: sanitizeUserInput(String(location?.floor || '').trim()),
        room: sanitizeUserInput(String(location?.room || '').trim())
    }

    // Validate incident data
    const validationResult = validateIncident({
        title: normalizedTitle,
        description: sanitizedDescription,
        location: incidentLocation
    })

    if (!validationResult.valid) {
        const error = new Error('Invalid incident data')
        error.code = 'VALIDATION_ERROR'
        error.details = validationResult.errors
        throw error
    }

    // Enhanced AI Analysis with Gemini
    console.log('Performing AI analysis for incident:', { title: normalizedTitle, description: sanitizedDescription })

    const aiAnalysis = await analyzeIncident(normalizedTitle, sanitizedDescription)
    console.log('AI Analysis completed:', aiAnalysis)

    // Pattern Detection - Check for repeated incidents
    const patternAnalysis = await detectPatternsForIncident(organizationId, incidentLocation, aiAnalysis.type)
    console.log('Pattern detection completed:', patternAnalysis)

    const emergencyData = {
        userId: user.uid,
        userName: sanitizeUserInput(user.fullName || 'Unknown'),
        phone: user.phone || 'N/A',
        // Keep `emergencyType` populated so existing dashboards continue working with older records.
        title: normalizedTitle,
        emergencyType: sanitizeUserInput(emergencyType || normalizedTitle),
        // Enhanced AI fields
        type: aiAnalysis.type,
        priority: aiAnalysis.priority,
        summary: aiAnalysis.summary,
        recommendations: aiAnalysis.recommendations,
        ai_confidence: aiAnalysis.confidence,
        // Pattern detection fields
        pattern_detected: patternAnalysis.pattern_detected,
        pattern_note: patternAnalysis.note,
        pattern_frequency_score: patternAnalysis.frequency_score,
        // Existing fields
        sla_limit: getSLALimitFromPriority(aiAnalysis.priority),
        risk_flag: aiAnalysis.priority === 'high' || patternAnalysis.pattern_detected,
        description: sanitizedDescription,
        latitude,
        longitude,
        location: incidentLocation,
        status: 'pending',
        assignedStaffId: null,
        assignedStaffName: '',
        escalation_level: 0,
        previousAssignedStaffIds: [],
        organizationId,
        organizationName: user.organizationName || 'Unknown Organization',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        events: [],
        is_critical: aiAnalysis.priority === 'high'
    }

    console.log('EmergencyService.createEmergency', {
        organizationId,
        organizationName: emergencyData.organizationName,
        userId: user.uid,
        title: normalizedTitle,
        description,
        latitude,
        longitude,
        location: incidentLocation
    })

    const docRef = await addDoc(collection(db, 'emergencies'), emergencyData)
    const emergencyRef = doc(db, 'emergencies', docRef.id)
    let wasAutoAssigned = false
    let bestStaff = null

    logActivity('EMERGENCY_CREATED', {
        userId: user.uid,
        organizationId,
        message: `Created emergency ${docRef.id}`,
        metadata: {
            emergencyId: docRef.id,
            title: normalizedTitle,
            latitude,
            longitude,
            location: incidentLocation
        }
    }).catch((loggingError) => console.warn('Failed to log emergency creation', loggingError))

    try {
        // Use smart assignment service
        const incidentData = {
            id: docRef.id,
            organizationId,
            emergencyType,
            locationDetails: incidentLocation
        }

        bestStaff = await getBestStaff(incidentData)

        // Fallback to location-based assignment if smart assignment fails
        if (!bestStaff) {
            console.log('Smart assignment returned no staff, using fallback')
            const staffQuery = query(
                collection(db, 'users'),
                where('organizationId', '==', organizationId),
                where('role', '==', 'staff')
            )

            const staffSnapshot = await getDocs(staffQuery)
            const staffUsers = staffSnapshot.docs.map((docSnapshot) => ({ uid: docSnapshot.id, ...docSnapshot.data() }))
            bestStaff = getFallbackStaff(staffUsers, incidentLocation)
        }

        if (bestStaff) {
            await runTransaction(db, async (transaction) => {
                const staffRef = doc(db, 'users', bestStaff.uid)
                const staffSnap = await transaction.get(staffRef)
                const currentCount = getStaffLoad(staffSnap.data())

                transaction.update(staffRef, {
                    active_incidents_count: currentCount + 1
                })

                transaction.update(emergencyRef, {
                    status: 'assigned',
                    assignedStaffId: bestStaff.uid,
                    assignedStaffName: bestStaff.fullName || bestStaff.displayName || 'Staff Member',
                    updatedAt: serverTimestamp()
                })
            })

            emergencyData.status = 'assigned'
            emergencyData.assignedStaffId = bestStaff.uid
            emergencyData.assignedStaffName = bestStaff.fullName || bestStaff.displayName || 'Staff Member'
            wasAutoAssigned = true
        }
    } catch (assignmentError) {
        console.warn('Auto-assignment failed; emergency will remain pending', assignmentError)
    }

    // Log creation event
    addEvent(docRef.id, 'CREATED', user.uid)
        .catch((error) => console.warn('Failed to log creation event', error))

    if (wasAutoAssigned && bestStaff) {
        // Log assignment event
        addEvent(docRef.id, 'ASSIGNED', bestStaff.uid)
            .catch((error) => console.warn('Failed to log assignment event', error))
        logActivity('EMERGENCY_ASSIGNED', {
            userId: user.uid,
            organizationId,
            message: `Emergency ${docRef.id} auto-assigned to staff ${bestStaff.uid}`,
            metadata: {
                emergencyId: docRef.id,
                assignedStaffId: bestStaff.uid,
                assignedStaffName: bestStaff.fullName || bestStaff.displayName || 'Staff Member'
            }
        }).catch((loggingError) => console.warn('Failed to log emergency assignment', loggingError))
        scheduleIncidentEscalation(docRef.id)
    }

    const notificationIncident = normalizeEmergencyRecord(docRef.id, emergencyData)
    const adminEmail = getNotificationAdminEmail(user)

    retryAsync(() => notifyIncidentCreated(notificationIncident, adminEmail), 3, 1000, { operationName: 'notifyIncidentCreated' })
        .catch((error) => console.warn('Incident created notification failed', error))

    if (wasAutoAssigned && bestStaff) {
        const staffEmail = bestStaff.email || bestStaff.contactEmail || ''
        const staffPhone = bestStaff.phone || bestStaff.phoneNumber || ''

        retryAsync(() => notifyStaffAssigned(notificationIncident, staffEmail, staffPhone), 3, 1000, { operationName: 'notifyStaffAssigned' })
            .catch((error) => console.warn('Staff assignment notification failed', error))
    }

    // Start AI metadata extraction after incident creation without blocking the main flow.
    updateIncidentWithAIFields(docRef.id, normalizedTitle, description)
        .catch((error) => console.warn('Background AI metadata update failed', error))

    return normalizeEmergencyRecord(docRef.id, emergencyData)
}

export const createEmergency = async (payload) => {
    if (isOffline()) {
        await queueOfflineRequest('createEmergency', payload)
        const error = new Error('Offline queued incident creation')
        error.code = 'OFFLINE_QUEUED'
        throw error
    }

    try {
        return await retryAsync(() => performCreateEmergency(payload), 3, 1000, { operationName: 'createEmergency' })
    } catch (error) {
        const isNetworkIssue = isOffline() || String(error?.message || '').toLowerCase().includes('network')
        if (isNetworkIssue) {
            await queueOfflineRequest('createEmergency', payload)
            logActivity('EMERGENCY_CREATE_OFFLINE_QUEUED', {
                userId: payload.user?.uid,
                organizationId: normalizeOrganizationId(payload.user?.organizationId || ''),
                message: 'Queued emergency create request because the client appears offline',
                metadata: {
                    payloadType: 'createEmergency',
                    emergencyTitle: payload.title || payload.emergencyType || 'Untitled Incident'
                }
            }).catch((loggingError) => console.warn('Failed to log offline emergency queue', loggingError))
            const queueError = new Error('Offline queued incident creation')
            queueError.code = 'OFFLINE_QUEUED'
            throw queueError
        }
        throw error
    }
}

export const syncQueuedIncidents = async () => {
    return await syncQueuedRequests({
        createEmergency: async (payload) => await performCreateEmergency(payload),
        notifyIncidentCreated: async ({ emergency, adminEmail }) => await notifyIncidentCreated(emergency, adminEmail),
        notifyStaffAssigned: async ({ emergency, staffEmail, staffPhone }) => await notifyStaffAssigned(emergency, staffEmail, staffPhone),
        notifyEscalation: async ({ emergency, adminEmail, newStaffEmail, newStaffPhone }) => await notifyEscalation(emergency, adminEmail, newStaffEmail, newStaffPhone),
        notifyCriticalAlert: async ({ emergency, adminEmail }) => await notifyCriticalAlert(emergency, adminEmail),
        logActivity: async (payload) => await logActivity(payload.action, payload),
        logError: async (payload) => await logError(null, payload)
    })
}

export const getQueuedIncidentCount = () => getQueuedRequestCount()

if (typeof window !== 'undefined' && window.addEventListener) {
    subscribeOnlineSync({
        createEmergency: async (payload) => await performCreateEmergency(payload),
        notifyIncidentCreated: async ({ emergency, adminEmail }) => await notifyIncidentCreated(emergency, adminEmail),
        notifyStaffAssigned: async ({ emergency, staffEmail, staffPhone }) => await notifyStaffAssigned(emergency, staffEmail, staffPhone),
        notifyEscalation: async ({ emergency, adminEmail, newStaffEmail, newStaffPhone }) => await notifyEscalation(emergency, adminEmail, newStaffEmail, newStaffPhone),
        notifyCriticalAlert: async ({ emergency, adminEmail }) => await notifyCriticalAlert(emergency, adminEmail),
        logActivity: async (payload) => await logActivity(payload.action, payload),
        logError: async (payload) => await logError(null, payload)
    })
}

export const fetchEmergencies = ({ organizationId, userId, onNext, onError }) => {
    const normalizedOrganizationId = normalizeOrganizationId(organizationId || '')

    if (!normalizedOrganizationId) {
        const guardError = new Error('Organization ID is required to fetch emergencies')
        onError?.(guardError)
        throw guardError
    }

    console.log('EmergencyService.fetchEmergencies', {
        organizationId: normalizedOrganizationId,
        userId
    })

    const filters = [where('organizationId', '==', normalizedOrganizationId)]
    if (userId) {
        filters.push(where('userId', '==', userId))
    }

    const q = query(
        collection(db, 'emergencies'),
        ...filters
    )

    return onSnapshot(
        q,
        (snapshot) => {
            const emergencies = sortEmergenciesByCreatedAt(
                snapshot.docs.map((docSnapshot) => normalizeEmergencyRecord(docSnapshot.id, docSnapshot.data()))
            )
            console.log('EmergencyService.fetchEmergencies: received emergencies', {
                organizationId: normalizedOrganizationId,
                userId,
                count: emergencies.length,
                emergencies: emergencies.map(e => ({ id: e.id, organizationId: e.organizationId, userId: e.userId }))
            })
            onNext?.(emergencies)
        },
        (error) => {
            console.error('EmergencyService.fetchEmergencies error', {
                organizationId: normalizedOrganizationId,
                userId,
                error: error.message,
                errorCode: error.code
            })
            onError?.(error)
        }
    )
}

export const acceptCase = async (caseId, user) => {
    if (!user || !user.uid) {
        throw new Error('User must be authenticated to accept a case')
    }

    console.log('EmergencyService.acceptCase', {
        caseId,
        assignedStaffId: user.uid
    })

    const caseRef = doc(db, 'emergencies', caseId)
    const actorOrganizationId = normalizeOrganizationId(user.organizationId || '')

    await runTransaction(db, async (transaction) => {
        const caseSnap = await transaction.get(caseRef)
        if (!caseSnap.exists()) {
            throw new Error('Emergency case not found')
        }

        const emergency = normalizeEmergencyRecord(caseSnap.id, caseSnap.data())
        const organizationId = emergency.organizationId

        if (!organizationId) {
            throw new Error('Emergency case missing organization ID')
        }

        if (!actorOrganizationId || actorOrganizationId !== organizationId) {
            throw new Error('You can only accept emergencies from your organization')
        }

        if (emergency.assignedStaffId && emergency.assignedStaffId !== user.uid) {
            throw new Error('This emergency has already been assigned')
        }

        if (emergency.status !== 'pending' && emergency.assignedStaffId !== user.uid) {
            throw new Error('Only pending emergencies can be accepted')
        }

        const updateData = {
            status: 'accepted',
            assignedStaffId: user.uid,
            assignedStaffName: user.fullName || user.displayName || 'Staff Member',
            accepted_at: serverTimestamp(),
            updatedAt: serverTimestamp(),
            events: arrayUnion({
                event_type: 'ACCEPTED',
                performed_by: user.uid,
                timestamp: new Date()
            })
        }

        transaction.update(caseRef, updateData)
    })

    console.log('EmergencyService.acceptCase success', { caseId })
    logActivity('EMERGENCY_ACCEPTED', {
        userId: user.uid,
        organizationId: actorOrganizationId,
        message: `Emergency ${caseId} accepted by ${user.uid}`,
        metadata: { emergencyId: caseId }
    }).catch((loggingError) => console.warn('Failed to log emergency acceptance', loggingError))
    return {
        caseId,
        status: 'accepted',
        assignedStaffId: user.uid,
        assignedStaffName: user.fullName || user.displayName || 'Staff Member'
    }
}

export const updateEmergencyStatus = async ({ emergencyId, status, actor }) => {
    // Security: Validate authentication
    if (!actor?.uid) {
        throw new Error('Authenticated user is required to update emergency status')
    }

    // Security: Check rate limit for updates
    const rateLimitCheck = rateLimiter.isIncidentUpdateAllowed(actor.uid)
    if (!rateLimitCheck.allowed) {
        const error = new Error('Too many update requests')
        error.code = 'RATE_LIMITED'
        error.retryAfter = rateLimitCheck.retryAfter
        throw error
    }

    // Security: Validate status
    const statusValidation = validateStatusUpdate(status)
    if (!statusValidation.valid) {
        const error = new Error(statusValidation.error)
        error.code = 'VALIDATION_ERROR'
        throw error
    }

    const normalizedStatus = normalizeEmergencyStatus(status)
    const emergencyRef = doc(db, 'emergencies', emergencyId)
    const actorOrganizationId = normalizeOrganizationId(actor.organizationId || '')

    await runTransaction(db, async (transaction) => {
        const emergencySnap = await transaction.get(emergencyRef)
        if (!emergencySnap.exists()) {
            throw new Error('Emergency case not found')
        }

        const emergency = normalizeEmergencyRecord(emergencySnap.id, emergencySnap.data())

        // Security: Check organization access
        if (!actorOrganizationId || emergency.organizationId !== actorOrganizationId) {
            throw new Error('You can only update emergencies from your organization')
        }

        // Security: Check role-based access
        const actorRole = actor.role || 'user'
        const isAdmin = actorRole === 'admin'
        const isAssignedStaff = emergency.assignedStaffId === actor.uid

        if (!isAdmin && !isAssignedStaff) {
            throw new Error('Only the assigned staff member or an admin can update this emergency')
        }

        const updateData = {
            status: normalizedStatus,
            updatedAt: serverTimestamp()
        }

        // Log status change events
        if (normalizedStatus === 'resolved') {
            updateData.resolved_at = serverTimestamp()
            updateData.events = arrayUnion({
                event_type: 'RESOLVED',
                performed_by: actor.uid,
                timestamp: new Date()
            })
        }

        transaction.update(emergencyRef, updateData)
    })

    logActivity('EMERGENCY_STATUS_UPDATED', {
        action: 'EMERGENCY_STATUS_UPDATED',
        userId: actor.uid,
        organizationId: actorOrganizationId,
        message: `Updated emergency ${emergencyId} status to ${normalizedStatus}`,
        metadata: { emergencyId, status: normalizedStatus }
    }).catch((loggingError) => console.warn('Failed to log status update', loggingError))
}

export const updateStaffLocation = async ({ staffId, building, floor }) => {
    if (!staffId) {
        throw new Error('Staff ID is required to update location')
    }

    console.log('EmergencyService.updateStaffLocation called', {
        staffId,
        building,
        floor
    })

    await updateDoc(doc(db, 'users', staffId), {
        current_location: {
            building: String(building || '').trim(),
            floor: String(floor || '').trim()
        },
        availability_status: 'available',
        location_updated_at: new Date()
    })
}

/**
 * Ensure staff profile has required location data
 * @param {string} staffId - Staff user ID
 * @returns {Promise<Object>} Staff location data
 */
export const ensureStaffLocationData = async (staffId) => {
    if (!staffId) return null

    try {
        const staffRef = doc(db, 'users', staffId)
        const staffSnap = await getDoc(staffRef)

        if (!staffSnap.exists()) return null

        const staffData = staffSnap.data()
        const currentLocation = staffData.current_location || staffData.currentLocation || {}

        // If location data is missing, return defaults
        if (!currentLocation.building || !currentLocation.floor) {
            return {
                building: currentLocation.building || '',
                floor: currentLocation.floor || '',
                needsUpdate: true
            }
        }

        return {
            building: currentLocation.building,
            floor: currentLocation.floor,
            needsUpdate: false
        }
    } catch (error) {
        console.error('Error checking staff location data:', error)
        return null
    }
}

export const assignEmergencyToStaff = async ({ emergencyId, staffUser, actor }) => {
    if (!actor?.uid || actor.role !== 'admin') {
        throw new Error('Only admins can assign emergencies')
    }

    if (!staffUser?.uid) {
        throw new Error('A staff member must be selected before assigning')
    }

    const actorOrganizationId = normalizeOrganizationId(actor.organizationId || '')
    const staffOrganizationId = normalizeOrganizationId(staffUser.organizationId || '')
    const emergencyRef = doc(db, 'emergencies', emergencyId)

    await runTransaction(db, async (transaction) => {
        const emergencySnap = await transaction.get(emergencyRef)
        if (!emergencySnap.exists()) {
            throw new Error('Emergency case not found')
        }

        const emergency = normalizeEmergencyRecord(emergencySnap.id, emergencySnap.data())

        if (!actorOrganizationId || emergency.organizationId !== actorOrganizationId) {
            throw new Error('You can only assign emergencies from your organization')
        }

        if (!staffOrganizationId || staffOrganizationId !== emergency.organizationId) {
            throw new Error('Selected staff member does not belong to this organization')
        }

        if (emergency.assignedStaffId && emergency.assignedStaffId !== staffUser.uid) {
            throw new Error('This emergency has already been assigned')
        }

        const updateData = {
            status: emergency.status === 'pending' ? 'accepted' : emergency.status,
            assignedStaffId: staffUser.uid,
            assignedStaffName: staffUser.fullName || staffUser.displayName || 'Staff Member',
            updatedAt: serverTimestamp()
        }

        if (emergency.status === 'pending') {
            updateData.accepted_at = serverTimestamp()
        }

        transaction.update(emergencyRef, updateData)
    })

    try {
        const updatedEmergencySnap = await getDoc(emergencyRef)
        const updatedEmergency = normalizeEmergencyRecord(emergencyRef.id, updatedEmergencySnap.data() || {})
        const staffEmail = staffUser.email || staffUser.contactEmail || ''
        const staffPhone = staffUser.phone || staffUser.phoneNumber || ''

        logActivity('EMERGENCY_MANUALLY_ASSIGNED', {
            userId: actor.uid,
            organizationId: actorOrganizationId,
            message: `Emergency ${emergencyId} assigned to ${staffUser.uid}`,
            metadata: { emergencyId, assignedStaffId: staffUser.uid }
        }).catch((loggingError) => console.warn('Failed to log manual assignment', loggingError))

        notifyStaffAssigned(updatedEmergency, staffEmail, staffPhone)
            .catch((error) => {
                logError(error, {
                    action: 'NOTIFY_STAFF_ASSIGNED',
                    organizationId: actorOrganizationId,
                    userId: actor.uid,
                    message: `Failed to notify staff ${staffUser.uid} after assignment for ${emergencyId}`,
                    metadata: { emergencyId, staffEmail, staffPhone }
                }).catch((loggingError) => console.warn('Failed to log staff assignment notification error', loggingError))
                console.warn('Staff assignment notification failed', error)
            })
    } catch (notificationError) {
        console.warn('Failed to notify staff of assignment', notificationError)
    }
}

export const fetchOrganizationStaff = async (organizationId) => {
    const normalizedOrganizationId = normalizeOrganizationId(organizationId || '')

    if (!normalizedOrganizationId) {
        return []
    }

    const staffQuery = query(
        collection(db, 'users'),
        where('organizationId', '==', normalizedOrganizationId)
    )

    const snapshot = await getDocs(staffQuery)

    return snapshot.docs
        .map((staffSnapshot) => {
            const rawCurrentLocation = staffSnapshot.data().current_location || staffSnapshot.data().currentLocation || {}
            const currentLocation = {
                building: String(rawCurrentLocation.building || '').trim(),
                floor: String(rawCurrentLocation.floor || '').trim()
            }

            return {
                uid: staffSnapshot.id,
                ...staffSnapshot.data(),
                organizationId: normalizeOrganizationId(staffSnapshot.data().organizationId || ''),
                current_location: currentLocation,
                currentLocationLabel: buildLocationLabel(currentLocation)
            }
        })
        .filter((staffUser) => staffUser.role === 'staff')
}

export const getAnalytics = async (organizationId) => {
    const normalizedOrganizationId = normalizeOrganizationId(organizationId || '')

    if (!normalizedOrganizationId) {
        throw new Error('Organization ID is required for analytics')
    }

    // Fetch all emergencies for the organization
    const emergenciesQuery = query(
        collection(db, 'emergencies'),
        where('organizationId', '==', normalizedOrganizationId)
    )

    const emergenciesSnap = await getDocs(emergenciesQuery)
    const emergencies = emergenciesSnap.docs.map(doc => normalizeEmergencyRecord(doc.id, doc.data()))

    // Calculate metrics
    const totalIncidents = emergencies.length

    // Calculate average response time (accepted_at - created_at for incidents >= accepted status)
    let totalResponseTime = 0
    let responseTimeCount = 0

    emergencies.forEach(emergency => {
        // Look for accepted event in timeline
        const acceptedEvent = emergency.events?.find(event => event.event_type === 'ACCEPTED')

        if (acceptedEvent && acceptedEvent.timestamp && emergency.createdAt) {
            try {
                const createdTime = emergency.createdAt.toDate ? emergency.createdAt.toDate() : new Date(emergency.createdAt)
                const acceptedTime = acceptedEvent.timestamp.toDate ? acceptedEvent.timestamp.toDate() : new Date(acceptedEvent.timestamp)

                const responseTimeMs = acceptedTime.getTime() - createdTime.getTime()
                if (responseTimeMs > 0) {
                    totalResponseTime += responseTimeMs
                    responseTimeCount++
                }
            } catch (error) {
                // Skip invalid timestamps
                console.warn('Invalid timestamp in emergency:', emergency.id, error)
            }
        }
    })

    const avgResponseTimeMinutes = responseTimeCount > 0 ? (totalResponseTime / responseTimeCount) / (1000 * 60) : 0

    // Calculate escalation rate (incidents with escalation_level > 0 / total incidents)
    const escalatedIncidents = emergencies.filter(emergency => (emergency.escalation_level || 0) > 0).length
    const escalationRate = totalIncidents > 0 ? (escalatedIncidents / totalIncidents) * 100 : 0

    return {
        total_incidents: totalIncidents,
        avg_response_time: Math.round(avgResponseTimeMinutes * 10) / 10, // Round to 1 decimal place
        escalation_rate: Math.round(escalationRate * 10) / 10 // Round to 1 decimal place
    }
}

export const getStaffPerformance = async (organizationId) => {
    const normalizedOrganizationId = normalizeOrganizationId(organizationId || '')

    if (!normalizedOrganizationId) {
        throw new Error('Organization ID is required for staff performance')
    }

    // Fetch all resolved emergencies for the organization
    const emergenciesQuery = query(
        collection(db, 'emergencies'),
        where('organizationId', '==', normalizedOrganizationId),
        where('status', '==', 'resolved')
    )

    const emergenciesSnap = await getDocs(emergenciesQuery)
    const resolvedEmergencies = emergenciesSnap.docs.map(doc => normalizeEmergencyRecord(doc.id, doc.data()))

    // Group by staff member
    const staffPerformance = {}

    resolvedEmergencies.forEach(emergency => {
        const staffId = emergency.assignedStaffId
        if (!staffId) return // Skip if no assigned staff

        if (!staffPerformance[staffId]) {
            staffPerformance[staffId] = {
                staff_id: staffId,
                staff_name: emergency.assignedStaffName || 'Unknown Staff',
                incidents_handled: 0,
                total_response_time: 0,
                response_time_count: 0,
                total_resolution_time: 0,
                resolution_time_count: 0
            }
        }

        staffPerformance[staffId].incidents_handled++

        // Calculate response time (accepted_at - created_at)
        if (emergency.accepted_at && emergency.createdAt) {
            try {
                const createdTime = emergency.createdAt.toDate ? emergency.createdAt.toDate() : new Date(emergency.createdAt)
                const acceptedTime = emergency.accepted_at.toDate ? emergency.accepted_at.toDate() : new Date(emergency.accepted_at)

                const responseTimeMs = acceptedTime.getTime() - createdTime.getTime()
                if (responseTimeMs > 0) {
                    staffPerformance[staffId].total_response_time += responseTimeMs
                    staffPerformance[staffId].response_time_count++
                }
            } catch (error) {
                console.warn('Invalid response time calculation for emergency:', emergency.id, error)
            }
        }

        // Calculate resolution time (resolved_at - created_at)
        if (emergency.resolved_at && emergency.createdAt) {
            try {
                const createdTime = emergency.createdAt.toDate ? emergency.createdAt.toDate() : new Date(emergency.createdAt)
                const resolvedTime = emergency.resolved_at.toDate ? emergency.resolved_at.toDate() : new Date(emergency.resolved_at)

                const resolutionTimeMs = resolvedTime.getTime() - createdTime.getTime()
                if (resolutionTimeMs > 0) {
                    staffPerformance[staffId].total_resolution_time += resolutionTimeMs
                    staffPerformance[staffId].resolution_time_count++
                }
            } catch (error) {
                console.warn('Invalid resolution time calculation for emergency:', emergency.id, error)
            }
        }
    })

    // Calculate averages and format results
    const performanceResults = Object.values(staffPerformance).map(staff => ({
        staff_id: staff.staff_id,
        staff_name: staff.staff_name,
        incidents_handled: staff.incidents_handled,
        avg_response_time: staff.response_time_count > 0
            ? Math.round((staff.total_response_time / staff.response_time_count) / (1000 * 60) * 10) / 10
            : 0,
        avg_resolution_time: staff.resolution_time_count > 0
            ? Math.round((staff.total_resolution_time / staff.resolution_time_count) / (1000 * 60) * 10) / 10
            : 0
    }))

    // Sort by incidents handled (descending)
    return performanceResults.sort((a, b) => b.incidents_handled - a.incidents_handled)
}

const checkCriticalStatus = async (incidentId) => {
    const incidentRef = doc(db, 'emergencies', incidentId)
    let shouldNotifyCritical = false
    let emergencyOrganizationId = ''

    await runTransaction(db, async (transaction) => {
        const incidentSnap = await transaction.get(incidentRef)
        if (!incidentSnap.exists()) {
            return
        }

        const emergency = normalizeEmergencyRecord(incidentSnap.id, incidentSnap.data())
        emergencyOrganizationId = emergency.organizationId

        // Skip if already critical
        if (emergency.is_critical) {
            return
        }

        let shouldBeCritical = false

        // Check escalation level
        if (emergency.escalation_level >= MAX_ESCALATION_LEVEL) {
            shouldBeCritical = true
        }

        // Check SLA breach
        if (emergency.createdAt && emergency.sla_limit) {
            const createdMillis = emergency.createdAt.seconds ? emergency.createdAt.seconds * 1000 : emergency.createdAt
            const elapsedSeconds = Math.max(0, Date.now() - createdMillis) / 1000
            if (elapsedSeconds > emergency.sla_limit) {
                shouldBeCritical = true
            }
        }

        // Update if critical status changed
        if (shouldBeCritical) {
            const updateData = {
                is_critical: true,
                status: emergency.status === 'pending' || emergency.status === 'accepted' ? 'critical' : emergency.status,
                updatedAt: new Date(),
                events: arrayUnion({
                    event_type: 'CRITICAL',
                    performed_by: 'system',
                    timestamp: new Date()
                })
            }

            transaction.update(incidentRef, updateData)
            shouldNotifyCritical = true
            console.warn('Incident marked as critical', incidentId)
        }
    })

    if (shouldNotifyCritical) {
        try {
            const updatedIncidentSnap = await getDoc(incidentRef)
            const updatedEmergency = normalizeEmergencyRecord(incidentRef.id, updatedIncidentSnap.data() || {})
            const staffEmails = await fetchOrganizationStaffEmails(emergencyOrganizationId)
            const adminEmail = getNotificationAdminEmail()

            notifyCriticalAlert(updatedEmergency, adminEmail, staffEmails)
                .catch((error) => console.warn('Critical alert notification failed', error))
        } catch (error) {
            console.warn('Failed to send critical alert notification', error)
        }
    }
}
