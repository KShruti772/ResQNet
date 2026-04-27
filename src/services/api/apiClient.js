/**
 * API Client Wrapper for Future Backend Integration
 *
 * This wrapper provides an abstraction layer that allows switching between
 * Firebase (current) and a real backend (future) without changing UI code.
 *
 * @file apiClient.js
 *
 * Usage:
 * ```javascript
 * import { apiClient } from '@/services/api/apiClient'
 *
 * // Current: Uses Firebase directly
 * const response = await apiClient.incidents.create(data)
 *
 * // Future: Will use HTTP calls to backend (no code change needed!)
 * const response = await apiClient.incidents.create(data)
 * // → Now calls https://api.example.com/api/incidents POST
 * ```
 */

import * as IncidentAPIModule from './incidentApi.js'
import * as StaffAPIModule from './staffApi.js'

/**
 * API Client - Abstraction layer for API calls
 *
 * Provides a unified interface for both Firebase (current) and
 * HTTP backend (future) implementations.
 *
 * @example
 * // Create incident
 * const response = await apiClient.incidents.create({
 *   title: 'Fire',
 *   description: 'Building A',
 *   user: currentUser
 * })
 *
 * // Get incidents
 * const response = await apiClient.incidents.list({
 *   organizationId: 'org-123'
 * })
 *
 * // Update incident
 * const response = await apiClient.incidents.updateStatus({
 *   incidentId: 'incident-123',
 *   status: 'resolved',
 *   actor: currentUser
 * })
 */
export const apiClient = {
    /**
     * Incident API endpoints
     * @type {Object}
     */
    incidents: {
        /**
         * Create a new incident
         * @async
         * @param {Object} data - Incident data
         * @returns {Promise<Object>} API response
         */
        create: async (data) => {
            return IncidentAPIModule.createIncident(data)
        },

        /**
         * List incidents
         * @async
         * @param {Object} filters - Query filters
         * @returns {Promise<Object>} API response
         */
        list: async (filters) => {
            return IncidentAPIModule.getIncidents(filters)
        },

        /**
         * Get single incident
         * @async
         * @param {string} incidentId - Incident ID
         * @returns {Promise<Object>} API response
         */
        get: async (incidentId) => {
            return IncidentAPIModule.getIncidentById({ incidentId })
        },

        /**
         * Update incident status
         * @async
         * @param {Object} data - Status update data
         * @returns {Promise<Object>} API response
         */
        updateStatus: async (data) => {
            return IncidentAPIModule.updateIncidentStatus(data)
        },

        /**
         * Assign staff to incident
         * @async
         * @param {Object} data - Assignment data
         * @returns {Promise<Object>} API response
         */
        assign: async (data) => {
            return IncidentAPIModule.assignStaff(data)
        },

        /**
         * Accept incident
         * @async
         * @param {Object} data - Acceptance data
         * @returns {Promise<Object>} API response
         */
        accept: async (data) => {
            return IncidentAPIModule.acceptIncident(data)
        },

        /**
         * Get incident analytics
         * @async
         * @param {string} organizationId - Organization ID
         * @returns {Promise<Object>} API response
         */
        analytics: async (organizationId) => {
            return IncidentAPIModule.getAnalytics({ organizationId })
        },

        /**
         * Get staff performance
         * @async
         * @param {string} organizationId - Organization ID
         * @returns {Promise<Object>} API response
         */
        performance: async (organizationId) => {
            return IncidentAPIModule.getStaffPerformance({ organizationId })
        }
    },

    /**
     * Staff API endpoints
     * @type {Object}
     */
    staff: {
        /**
         * List staff members
         * @async
         * @param {string} organizationId - Organization ID
         * @returns {Promise<Object>} API response
         */
        list: async (organizationId) => {
            return StaffAPIModule.getStaff({ organizationId })
        },

        /**
         * Get single staff member
         * @async
         * @param {string} staffId - Staff ID
         * @param {string} organizationId - Organization ID
         * @returns {Promise<Object>} API response
         */
        get: async (staffId, organizationId) => {
            return StaffAPIModule.getStaffById({ staffId, organizationId })
        },

        /**
         * Update staff location
         * @async
         * @param {Object} data - Location data
         * @returns {Promise<Object>} API response
         */
        updateLocation: async (data) => {
            return StaffAPIModule.updateLocation(data)
        },

        /**
         * Check staff availability
         * @async
         * @param {string} staffId - Staff ID
         * @returns {Promise<Object>} API response
         */
        checkAvailability: async (staffId) => {
            return StaffAPIModule.checkAvailability({ staffId })
        }
    }
}

/**
 * HTTP Client for Future Backend
 *
 * This is a placeholder for HTTP client implementation.
 * When migrating to a real backend, replace the above Firebase calls
 * with HTTP requests using this client.
 *
 * @example
 * ```javascript
 * // Create HTTP-based API client (for future use)
 * export const createHttpApiClient = (baseURL) => {
 *   return {
 *     incidents: {
 *       create: (data) => fetch(`${baseURL}/incidents`, {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify(data)
 *       }).then(r => r.json()),
 *
 *       list: (filters) => fetch(
 *         `${baseURL}/incidents?${new URLSearchParams(filters)}`
 *       ).then(r => r.json()),
 *
 *       updateStatus: (data) => fetch(
 *         `${baseURL}/incidents/${data.incidentId}/status`,
 *         {
 *           method: 'PUT',
 *           headers: { 'Content-Type': 'application/json' },
 *           body: JSON.stringify(data)
 *         }
 *       ).then(r => r.json())
 *     }
 *   }
 * }
 * ```
 *
 * Migration Steps:
 * 1. Create HTTP client (see example above)
 * 2. Initialize: `const httpClient = createHttpApiClient('http://localhost:3000/api')`
 * 3. Replace: `export const apiClient = httpClient`
 * 4. UI code requires NO changes!
 */

export default apiClient
