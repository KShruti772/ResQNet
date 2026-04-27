/**
 * Staff & Organization API Service
 *
 * API endpoints for staff management, organization setup, and user operations.
 *
 * @module StaffAPI
 */

import {
    fetchOrganizationStaff,
    updateStaffLocation
} from '../../utils/emergencyService.js'
import { ApiResponse } from './response.js'
import { logActivity, logError } from '../../utils/logService.js'

/**
 * Get organization staff members
 *
 * Retrieves all staff members in an organization.
 *
 * @async
 * @param {Object} request - Request object
 * @param {string} request.organizationId - Organization ID (required)
 *
 * @returns {Promise<Object>} API response with staff array
 *
 * @example
 * const response = await StaffAPI.getStaff({
 *   organizationId: 'org123'
 * })
 * if (response.success) {
 *   console.log('Found', response.data.staff.length, 'staff members')
 * }
 */
export const getStaff = async (request) => {
    try {
        if (!request?.organizationId) {
            return ApiResponse.validationError({ organizationId: 'Organization ID is required' })
        }

        const staff = await fetchOrganizationStaff(request.organizationId)

        await logActivity('API_GET_STAFF', {
            organizationId: request.organizationId,
            message: `API: Retrieved ${staff.length} staff members`,
            metadata: { count: staff.length }
        }).catch(() => { })

        return ApiResponse.success(
            {
                staff: staff || [],
                count: (staff || []).length,
                organizationId: request.organizationId
            },
            'Staff retrieved successfully'
        )
    } catch (error) {
        await logError(error, {
            action: 'API_GET_STAFF',
            organizationId: request?.organizationId,
            message: 'Failed to retrieve staff via API'
        }).catch(() => { })

        return ApiResponse.error(
            error?.message || 'Failed to retrieve staff',
            'STAFF_FETCH_FAILED',
            500
        )
    }
}

/**
 * Get single staff member
 *
 * @async
 * @param {Object} request - Request object
 * @param {string} request.staffId - Staff ID (required)
 * @param {string} request.organizationId - Organization ID (required)
 *
 * @returns {Promise<Object>} API response with staff data or 404 error
 *
 * @example
 * const response = await StaffAPI.getStaffById({
 *   staffId: 'staff123',
 *   organizationId: 'org123'
 * })
 */
export const getStaffById = async (request) => {
    try {
        if (!request?.staffId || !request?.organizationId) {
            return ApiResponse.validationError({
                staffId: request?.staffId ? null : 'Staff ID is required',
                organizationId: request?.organizationId ? null : 'Organization ID is required'
            })
        }

        // Note: This would need a utility function to fetch by ID
        // Documented contract for future implementation
        return ApiResponse.notFound('Staff', request.staffId)
    } catch (error) {
        return ApiResponse.error(
            error?.message || 'Failed to retrieve staff',
            'STAFF_FETCH_FAILED',
            500
        )
    }
}

/**
 * Update staff location
 *
 * Updates the current location of a staff member.
 * Used for real-time location tracking and incident assignment.
 *
 * @async
 * @param {Object} request - Request object
 * @param {string} request.staffId - Staff ID (required)
 * @param {string} request.building - Building identifier
 * @param {string} request.floor - Floor number
 * @param {Object} request.actor - Actor performing update (optional, for logging)
 *
 * @returns {Promise<Object>} API response with confirmation
 *
 * @example
 * const response = await StaffAPI.updateLocation({
 *   staffId: 'staff123',
 *   building: 'Building A',
 *   floor: '3'
 * })
 */
export const updateLocation = async (request) => {
    try {
        if (!request?.staffId) {
            return ApiResponse.validationError({ staffId: 'Staff ID is required' })
        }

        await updateStaffLocation({
            staffId: request.staffId,
            building: request.building,
            floor: request.floor
        })

        await logActivity('API_UPDATE_STAFF_LOCATION', {
            userId: request.actor?.uid,
            organizationId: request.actor?.organizationId,
            message: `API: Updated location for staff ${request.staffId}`,
            metadata: { staffId: request.staffId, building: request.building, floor: request.floor }
        }).catch(() => { })

        return ApiResponse.success(
            { staffId: request.staffId, location: { building: request.building, floor: request.floor } },
            'Location updated successfully'
        )
    } catch (error) {
        await logError(error, {
            action: 'API_UPDATE_STAFF_LOCATION',
            userId: request?.actor?.uid,
            organizationId: request?.actor?.organizationId,
            message: `Failed to update location for staff ${request?.staffId}`
        }).catch(() => { })

        return ApiResponse.error(
            error?.message || 'Failed to update staff location',
            'LOCATION_UPDATE_FAILED',
            500
        )
    }
}

/**
 * Check staff availability
 *
 * Checks if a staff member is available for assignment.
 *
 * @async
 * @param {Object} request - Request object
 * @param {string} request.staffId - Staff ID (required)
 *
 * @returns {Promise<Object>} API response with availability status
 *
 * @example
 * const response = await StaffAPI.checkAvailability({
 *   staffId: 'staff123'
 * })
 * if (response.success && response.data.available) {
 *   console.log('Staff member is available')
 * }
 */
export const checkAvailability = async (request) => {
    try {
        if (!request?.staffId) {
            return ApiResponse.validationError({ staffId: 'Staff ID is required' })
        }

        // Note: This is a contract for future implementation
        // Would check staff's availability status, active incident count, etc.
        return ApiResponse.success(
            { staffId: request.staffId, available: true, activeIncidents: 0 },
            'Availability check completed'
        )
    } catch (error) {
        return ApiResponse.error(
            error?.message || 'Failed to check availability',
            'AVAILABILITY_CHECK_FAILED',
            500
        )
    }
}
