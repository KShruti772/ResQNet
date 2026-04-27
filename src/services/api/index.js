/**
 * Main API Entry Point
 *
 * Central export for all API services.
 * This provides a clean interface for both UI and external integrations.
 *
 * @module API
 */

export * as IncidentAPI from './incidentApi.js'
export * as StaffAPI from './staffApi.js'
export { ApiResponse } from './response.js'
export { apiClient } from './apiClient.js'

/**
 * Complete API Documentation
 *
 * @namespace API
 *
 * ## Incident Management
 *
 * ### IncidentAPI.createIncident(request)
 * Creates a new emergency incident with automatic staff assignment
 * - Request: { title, description, emergencyType, user, latitude?, longitude?, location? }
 * - Response: { success, data: incident, error, code }
 *
 * ### IncidentAPI.getIncidents(request)
 * Retrieves incidents for an organization
 * - Request: { organizationId, userId?, status?, limit?, offset? }
 * - Response: { success, data: { incidents, count, filters }, error, code }
 *
 * ### IncidentAPI.updateIncidentStatus(request)
 * Updates incident status (pending, accepted, in_progress, resolved, etc)
 * - Request: { incidentId, status, actor: { uid, role, organizationId } }
 * - Response: { success, data: { incidentId, status }, error, code }
 *
 * ### IncidentAPI.assignStaff(request)
 * Assigns a staff member to an incident (admin only)
 * - Request: { incidentId, staffId, actor: { uid, role, organizationId } }
 * - Response: { success, data: { incidentId, assignedStaffId }, error, code }
 *
 * ### IncidentAPI.acceptIncident(request)
 * Marks an incident as accepted by assigned staff
 * - Request: { incidentId, user: { uid, organizationId, fullName } }
 * - Response: { success, data: { incidentId, status }, error, code }
 *
 * ### IncidentAPI.getAnalytics(request)
 * Retrieves organization analytics
 * - Request: { organizationId }
 * - Response: { success, data: { total_incidents, avg_response_time, escalation_rate }, error, code }
 *
 * ### IncidentAPI.getStaffPerformance(request)
 * Gets staff performance metrics
 * - Request: { organizationId }
 * - Response: { success, data: [{ staff_id, incidents_handled, avg_response_time, ... }], error, code }
 *
 * ## Staff Management
 *
 * ### StaffAPI.getStaff(request)
 * Retrieves all staff in an organization
 * - Request: { organizationId }
 * - Response: { success, data: { staff, count, organizationId }, error, code }
 *
 * ### StaffAPI.updateLocation(request)
 * Updates staff member location
 * - Request: { staffId, building, floor, actor? }
 * - Response: { success, data: { staffId, location }, error, code }
 *
 * ### StaffAPI.checkAvailability(request)
 * Checks if staff member is available
 * - Request: { staffId }
 * - Response: { success, data: { staffId, available, activeIncidents }, error, code }
 *
 * ## Standard Response Format
 *
 * All API endpoints return responses in this format:
 * ```
 * {
 *   success: boolean,
 *   data: any | null,
 *   message: string,
 *   error: { message, code, details } | null,
 *   code: number (HTTP-like status code),
 *   timestamp: ISO string
 * }
 * ```
 *
 * ## Error Codes
 *
 * - UNAUTHORIZED (401): Authentication required
 * - FORBIDDEN (403): Permission denied
 * - VALIDATION_ERROR (422): Invalid input
 * - NOT_FOUND (404): Resource not found
 * - INCIDENT_CREATE_FAILED (400): Failed to create incident
 * - STATUS_UPDATE_FAILED (400): Failed to update status
 * - ASSIGNMENT_FAILED (400): Failed to assign staff
 * - STAFF_FETCH_FAILED (400): Failed to fetch staff
 * - ANALYTICS_FAILED (400): Failed to get analytics
 * - INTERNAL_ERROR (500): Unexpected error
 *
 * ## Usage Examples
 *
 * ### Create Incident
 * ```javascript
 * import { IncidentAPI } from '@/services/api'
 *
 * const response = await IncidentAPI.createIncident({
 *   title: 'Fire in Building A',
 *   description: 'Fire detected on third floor',
 *   emergencyType: 'Fire',
 *   user: { uid: 'user123', organizationId: 'org456', fullName: 'John Doe' },
 *   latitude: 40.7128,
 *   longitude: -74.0060,
 *   location: { building: 'A', floor: '3' }
 * })
 *
 * if (response.success) {
 *   console.log('Created:', response.data.id)
 * } else {
 *   console.error('Error:', response.error.message)
 * }
 * ```
 *
 * ### Get Incidents
 * ```javascript
 * const response = await IncidentAPI.getIncidents({
 *   organizationId: 'org456',
 *   status: 'pending'
 * })
 *
 * if (response.success) {
 *   response.data.incidents.forEach(incident => {
 *     console.log(incident.title, incident.status)
 *   })
 * }
 * ```
 *
 * ### Update Status
 * ```javascript
 * const response = await IncidentAPI.updateIncidentStatus({
 *   incidentId: 'incident789',
 *   status: 'resolved',
 *   actor: { uid: 'staff123', role: 'staff', organizationId: 'org456' }
 * })
 * ```
 *
 * ## External Integration Example
 *
 * IoT/CCTV systems can call these APIs:
 *
 * ```javascript
 * // IoT Sensor detects fire
 * async function handleFireDetection(building, floor) {
 *   const response = await IncidentAPI.createIncident({
 *     title: `Fire Detected - ${building}`,
 *     description: `Automatic detection from IoT sensors`,
 *     emergencyType: 'Fire',
 *     user: {
 *       uid: 'iot-system',
 *       organizationId: 'org456',
 *       fullName: 'Automated System'
 *     },
 *     location: { building, floor }
 *   })
 *
 *   if (response.success) {
 *     console.log('Incident created:', response.data.id)
 *     // Send alert to external system
 *     await externalAlertSystem.notify(response.data)
 *   }
 * }
 * ```
 */
