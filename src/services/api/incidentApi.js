/**
 * Emergency/Incident API Service
 *
 * Core API endpoints for emergency incident management.
 * All functions follow REST-like design and return standardized responses.
 *
 * @module IncidentAPI
 */

import {
    performCreateEmergency,
    handleIncidentEscalation,
    updateEmergencyStatus as updateEmergencyStatusUtil,
    acceptCase,
    assignEmergencyToStaff,
    fetchEmergencies,
    getAnalytics,
    getStaffPerformance,
    checkSLARisk
} from '../../utils/emergencyService.js'
import { ApiResponse } from './response.js'
import { logActivity, logError } from '../../utils/logService.js'

/**
 * Create a new emergency incident
 *
 * Creates a new emergency incident with automatic staff assignment
 * and sends notifications to relevant personnel.
 *
 * @async
 * @param {Object} request - Request object
 * @param {string} request.title - Incident title
 * @param {string} request.description - Incident description
 * @param {string} request.emergencyType - Type of emergency (fire, medical, security, etc)
 * @param {Object} request.user - Authenticated user object
 * @param {string} request.user.uid - User ID
 * @param {string} request.user.organizationId - Organization ID
 * @param {string} request.user.fullName - User's full name
 * @param {number} [request.latitude] - Incident latitude coordinate
 * @param {number} [request.longitude] - Incident longitude coordinate
 * @param {Object} [request.location] - Location details (building, floor, room)
 *
 * @returns {Promise<Object>} API response with created incident data
 *
 * @example
 * const response = await IncidentAPI.createIncident({
 *   title: 'Building Fire',
 *   description: 'Fire detected in Building A',
 *   emergencyType: 'Fire',
 *   user: { uid: 'user123', organizationId: 'org456', fullName: 'John Doe' },
 *   latitude: 40.7128,
 *   longitude: -74.0060,
 *   location: { building: 'A', floor: '3', room: '301' }
 * })
 * if (response.success) {
 *   console.log('Incident created:', response.data.id)
 * } else {
 *   console.error('Error:', response.error.message)
 * }
 */
export const createIncident = async (request) => {
    try {
        // Validate request
        if (!request?.user?.uid) {
            return ApiResponse.unauthorized('User authentication required')
        }

        if (!request?.title || !request?.description) {
            return ApiResponse.validationError({
                title: request?.title ? null : 'Title is required',
                description: request?.description ? null : 'Description is required'
            })
        }

        // Create incident
        const incident = await performCreateEmergency({
            user: request.user,
            title: request.title,
            description: request.description,
            emergencyType: request.emergencyType,
            latitude: request.latitude,
            longitude: request.longitude,
            location: request.location
        })

        await logActivity('API_CREATE_INCIDENT', {
            userId: request.user.uid,
            organizationId: request.user.organizationId,
            message: `API: Created incident ${incident.id}`,
            metadata: { incidentId: incident.id, title: request.title }
        }).catch(() => { })

        return ApiResponse.created(incident, 'Incident created successfully')
    } catch (error) {
        await logError(error, {
            action: 'API_CREATE_INCIDENT',
            userId: request?.user?.uid,
            organizationId: request?.user?.organizationId,
            message: 'Failed to create incident via API'
        }).catch(() => { })

        return ApiResponse.error(
            error?.message || 'Failed to create incident',
            error?.code || 'INCIDENT_CREATE_FAILED',
            500
        )
    }
}

/**
 * Get incidents with optional filters
 *
 * Fetches incidents for an organization with optional filtering
 * by status, user, or other criteria.
 *
 * @async
 * @param {Object} request - Request object
 * @param {string} request.organizationId - Organization ID (required)
 * @param {string} [request.userId] - Filter by reporter user ID
 * @param {string} [request.status] - Filter by status (pending, accepted, resolved, etc)
 * @param {number} [request.limit] - Limit number of results (default 50)
 * @param {number} [request.offset] - Offset for pagination (default 0)
 *
 * @returns {Promise<Object>} API response with incidents array and metadata
 *
 * @example
 * const response = await IncidentAPI.getIncidents({
 *   organizationId: 'org123',
 *   status: 'pending',
 *   limit: 20
 * })
 * if (response.success) {
 *   console.log(`Found ${response.data.incidents.length} incidents`)
 * }
 */
export const getIncidents = async (request) => {
    try {
        if (!request?.organizationId) {
            return ApiResponse.validationError({ organizationId: 'Organization ID is required' })
        }

        const incidents = await new Promise((resolve, reject) => {
            const unsubscribe = fetchEmergencies({
                organizationId: request.organizationId,
                userId: request.userId,
                onNext: resolve,
                onError: reject
            })
            // Unsubscribe to avoid memory leaks
            setTimeout(() => unsubscribe?.(), 5000)
        })

        await logActivity('API_GET_INCIDENTS', {
            organizationId: request.organizationId,
            message: `API: Retrieved ${incidents.length} incidents`,
            metadata: { count: incidents.length, filters: { userId: request.userId, status: request.status } }
        }).catch(() => { })

        return ApiResponse.success(
            {
                incidents: incidents || [],
                count: (incidents || []).length,
                filters: {
                    organizationId: request.organizationId,
                    userId: request.userId,
                    status: request.status
                }
            },
            'Incidents retrieved successfully'
        )
    } catch (error) {
        await logError(error, {
            action: 'API_GET_INCIDENTS',
            organizationId: request?.organizationId,
            message: 'Failed to retrieve incidents via API'
        }).catch(() => { })

        return ApiResponse.error(
            error?.message || 'Failed to retrieve incidents',
            error?.code || 'INCIDENT_FETCH_FAILED',
            500
        )
    }
}

/**
 * Get a single incident by ID
 *
 * @async
 * @param {Object} request - Request object
 * @param {string} request.incidentId - Incident ID (required)
 *
 * @returns {Promise<Object>} API response with incident data or 404 error
 *
 * @example
 * const response = await IncidentAPI.getIncidentById({
 *   incidentId: 'incident123'
 * })
 */
export const getIncidentById = async (request) => {
    try {
        if (!request?.incidentId) {
            return ApiResponse.validationError({ incidentId: 'Incident ID is required' })
        }

        // Note: This would need a utility function to fetch by ID
        // For now, we document the contract
        return ApiResponse.notFound('Incident', request.incidentId)
    } catch (error) {
        return ApiResponse.error(
            error?.message || 'Failed to retrieve incident',
            'INCIDENT_FETCH_FAILED',
            500
        )
    }
}

/**
 * Update incident status
 *
 * Updates the status of an incident (pending, accepted, in_progress, resolved, etc)
 * Only authenticated staff or admin can update incidents.
 *
 * @async
 * @param {Object} request - Request object
 * @param {string} request.incidentId - Incident ID (required)
 * @param {string} request.status - New status (required)
 * @param {Object} request.actor - Actor performing the update (required)
 * @param {string} request.actor.uid - Actor user ID
 * @param {string} request.actor.role - Actor role (admin, staff, user)
 * @param {string} request.actor.organizationId - Actor organization ID
 *
 * @returns {Promise<Object>} API response with updated incident data
 *
 * @example
 * const response = await IncidentAPI.updateIncidentStatus({
 *   incidentId: 'incident123',
 *   status: 'resolved',
 *   actor: { uid: 'user456', role: 'staff', organizationId: 'org123' }
 * })
 */
export const updateIncidentStatus = async (request) => {
    try {
        if (!request?.actor?.uid) {
            return ApiResponse.unauthorized('Actor authentication required')
        }

        if (!request?.incidentId || !request?.status) {
            return ApiResponse.validationError({
                incidentId: request?.incidentId ? null : 'Incident ID is required',
                status: request?.status ? null : 'Status is required'
            })
        }

        await updateEmergencyStatusUtil({
            emergencyId: request.incidentId,
            status: request.status,
            actor: request.actor
        })

        await logActivity('API_UPDATE_INCIDENT_STATUS', {
            userId: request.actor.uid,
            organizationId: request.actor.organizationId,
            message: `API: Updated incident ${request.incidentId} status to ${request.status}`,
            metadata: { incidentId: request.incidentId, newStatus: request.status }
        }).catch(() => { })

        return ApiResponse.success(
            { incidentId: request.incidentId, status: request.status },
            'Incident status updated successfully'
        )
    } catch (error) {
        await logError(error, {
            action: 'API_UPDATE_INCIDENT_STATUS',
            userId: request?.actor?.uid,
            organizationId: request?.actor?.organizationId,
            message: `Failed to update incident ${request?.incidentId} status`,
            metadata: { newStatus: request?.status }
        }).catch(() => { })

        return ApiResponse.error(
            error?.message || 'Failed to update incident status',
            error?.code || 'STATUS_UPDATE_FAILED',
            500
        )
    }
}

/**
 * Assign staff to incident
 *
 * Manually assigns a staff member to an incident.
 * Only admins can perform this operation.
 *
 * @async
 * @param {Object} request - Request object
 * @param {string} request.incidentId - Incident ID (required)
 * @param {string} request.staffId - Staff member ID to assign (required)
 * @param {Object} request.actor - Actor performing assignment (required)
 * @param {string} request.actor.uid - Actor user ID
 * @param {string} request.actor.role - Actor role (must be admin)
 * @param {string} request.actor.organizationId - Actor organization ID
 *
 * @returns {Promise<Object>} API response with assignment confirmation
 *
 * @example
 * const response = await IncidentAPI.assignStaff({
 *   incidentId: 'incident123',
 *   staffId: 'staff789',
 *   actor: { uid: 'admin123', role: 'admin', organizationId: 'org123' }
 * })
 */
export const assignStaff = async (request) => {
    try {
        if (!request?.actor?.uid) {
            return ApiResponse.unauthorized('Actor authentication required')
        }

        if (request?.actor?.role !== 'admin') {
            return ApiResponse.forbidden('Only admins can assign incidents')
        }

        if (!request?.incidentId || !request?.staffId) {
            return ApiResponse.validationError({
                incidentId: request?.incidentId ? null : 'Incident ID is required',
                staffId: request?.staffId ? null : 'Staff ID is required'
            })
        }

        // Note: This assumes staff object is available
        // Real implementation would fetch staff details from Firestore
        await assignEmergencyToStaff({
            emergencyId: request.incidentId,
            staffUser: { uid: request.staffId },
            actor: request.actor
        })

        await logActivity('API_ASSIGN_STAFF', {
            userId: request.actor.uid,
            organizationId: request.actor.organizationId,
            message: `API: Assigned incident ${request.incidentId} to staff ${request.staffId}`,
            metadata: { incidentId: request.incidentId, staffId: request.staffId }
        }).catch(() => { })

        return ApiResponse.success(
            { incidentId: request.incidentId, assignedStaffId: request.staffId },
            'Staff assigned successfully'
        )
    } catch (error) {
        await logError(error, {
            action: 'API_ASSIGN_STAFF',
            userId: request?.actor?.uid,
            organizationId: request?.actor?.organizationId,
            message: `Failed to assign incident ${request?.incidentId}`,
            metadata: { staffId: request?.staffId }
        }).catch(() => { })

        return ApiResponse.error(
            error?.message || 'Failed to assign staff',
            error?.code || 'ASSIGNMENT_FAILED',
            500
        )
    }
}

/**
 * Accept incident case
 *
 * Marks incident as accepted by the assigned staff member.
 *
 * @async
 * @param {Object} request - Request object
 * @param {string} request.incidentId - Incident ID (required)
 * @param {Object} request.user - User accepting the case (required)
 * @param {string} request.user.uid - User ID
 * @param {string} request.user.organizationId - User organization ID
 * @param {string} request.user.fullName - User full name
 *
 * @returns {Promise<Object>} API response with acceptance confirmation
 *
 * @example
 * const response = await IncidentAPI.acceptIncident({
 *   incidentId: 'incident123',
 *   user: { uid: 'staff789', organizationId: 'org123', fullName: 'Jane Doe' }
 * })
 */
export const acceptIncident = async (request) => {
    try {
        if (!request?.user?.uid) {
            return ApiResponse.unauthorized('User authentication required')
        }

        if (!request?.incidentId) {
            return ApiResponse.validationError({ incidentId: 'Incident ID is required' })
        }

        await acceptCase(request.incidentId, request.user)

        await logActivity('API_ACCEPT_INCIDENT', {
            userId: request.user.uid,
            organizationId: request.user.organizationId,
            message: `API: Accepted incident ${request.incidentId}`,
            metadata: { incidentId: request.incidentId, staffId: request.user.uid }
        }).catch(() => { })

        return ApiResponse.success(
            { incidentId: request.incidentId, status: 'accepted' },
            'Incident accepted successfully'
        )
    } catch (error) {
        await logError(error, {
            action: 'API_ACCEPT_INCIDENT',
            userId: request?.user?.uid,
            organizationId: request?.user?.organizationId,
            message: `Failed to accept incident ${request?.incidentId}`
        }).catch(() => { })

        return ApiResponse.error(
            error?.message || 'Failed to accept incident',
            error?.code || 'ACCEPT_FAILED',
            500
        )
    }
}

/**
 * Get incident analytics
 *
 * Retrieves analytics metrics for an organization.
 * Includes total incidents, average response time, escalation rate, etc.
 *
 * @async
 * @param {Object} request - Request object
 * @param {string} request.organizationId - Organization ID (required)
 *
 * @returns {Promise<Object>} API response with analytics data
 *
 * @example
 * const response = await IncidentAPI.getAnalytics({
 *   organizationId: 'org123'
 * })
 * if (response.success) {
 *   console.log('Total incidents:', response.data.total_incidents)
 *   console.log('Avg response time:', response.data.avg_response_time, 'minutes')
 * }
 */
export const getAnalytics = async (request) => {
    try {
        if (!request?.organizationId) {
            return ApiResponse.validationError({ organizationId: 'Organization ID is required' })
        }

        const analytics = await getAnalytics(request.organizationId)

        await logActivity('API_GET_ANALYTICS', {
            organizationId: request.organizationId,
            message: `API: Retrieved analytics for ${request.organizationId}`,
            metadata: { analytics }
        }).catch(() => { })

        return ApiResponse.success(analytics, 'Analytics retrieved successfully')
    } catch (error) {
        await logError(error, {
            action: 'API_GET_ANALYTICS',
            organizationId: request?.organizationId,
            message: 'Failed to retrieve analytics via API'
        }).catch(() => { })

        return ApiResponse.error(
            error?.message || 'Failed to retrieve analytics',
            'ANALYTICS_FAILED',
            500
        )
    }
}

/**
 * Get staff performance metrics
 *
 * Retrieves performance metrics for staff members in an organization.
 *
 * @async
 * @param {Object} request - Request object
 * @param {string} request.organizationId - Organization ID (required)
 *
 * @returns {Promise<Object>} API response with performance data array
 *
 * @example
 * const response = await IncidentAPI.getStaffPerformance({
 *   organizationId: 'org123'
 * })
 */
export const getStaffPerformance = async (request) => {
    try {
        if (!request?.organizationId) {
            return ApiResponse.validationError({ organizationId: 'Organization ID is required' })
        }

        const performance = await getStaffPerformance(request.organizationId)

        return ApiResponse.success(performance, 'Staff performance retrieved successfully')
    } catch (error) {
        await logError(error, {
            action: 'API_GET_STAFF_PERFORMANCE',
            organizationId: request?.organizationId,
            message: 'Failed to retrieve staff performance via API'
        }).catch(() => { })

        return ApiResponse.error(
            error?.message || 'Failed to retrieve staff performance',
            'PERFORMANCE_FAILED',
            500
        )
    }
}
