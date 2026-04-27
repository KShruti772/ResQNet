/**
 * API SERVICE LAYER - COMPREHENSIVE DOCUMENTATION
 *
 * @file API_DOCUMENTATION.md
 *
 * This document describes the complete API service layer architecture,
 * design patterns, and integration guidelines.
 *
 * ============================================================================
 * TABLE OF CONTENTS
 * ============================================================================
 *
 * 1. Architecture Overview
 * 2. Service Layer Structure
 * 3. API Functions Reference
 * 4. Standard Response Format
 * 5. Error Handling
 * 6. Authentication & Authorization
 * 7. Integration Examples
 * 8. Future Backend Migration
 * 9. External System Integration
 *
 * ============================================================================
 * 1. ARCHITECTURE OVERVIEW
 * ============================================================================
 *
 * The application uses a clean service layer architecture that separates
 * business logic from UI components. This allows for:
 *
 * - Easy testing and debugging
 * - Reusable code across components
 * - Clear API contracts with external systems
 * - Future migration to a real backend
 *
 * Current Stack: React + Firebase + Service Layer
 * Future Stack: React + Node.js/Express Backend + Service Layer (same API!)
 *
 * Directory Structure:
 * ```
 * src/
 * ├── services/
 * │   ├── api/
 * │   │   ├── response.js           # Response builder
 * │   │   ├── incidentApi.js        # Incident endpoints
 * │   │   ├── staffApi.js           # Staff endpoints
 * │   │   ├── index.js              # Main exports
 * │   │   └── mockExpressBackend.js # Backend reference
 * │   ├── notificationService.js    # Email/SMS/Push
 * │   └── assignmentService.js      # Smart assignment
 * ├── utils/
 * │   ├── emergencyService.js       # Core business logic
 * │   ├── logService.js             # Activity logging
 * │   ├── retryService.js           # Offline/retry logic
 * │   └── validationService.js      # Input validation
 * ├── components/                   # React UI components
 * ├── pages/                        # Page components
 * └── hooks/                        # Custom React hooks
 * ```
 *
 * ============================================================================
 * 2. SERVICE LAYER STRUCTURE
 * ============================================================================
 *
 * The service layer is organized into logical API modules:
 *
 * ### response.js
 * - ApiResponse.success(data, message)
 * - ApiResponse.created(data, message)
 * - ApiResponse.error(message, code, statusCode, details)
 * - ApiResponse.notFound(resourceType, id)
 * - ApiResponse.unauthorized(message)
 * - ApiResponse.forbidden(message)
 * - ApiResponse.validationError(errors)
 *
 * ### incidentApi.js (IncidentAPI namespace)
 * - createIncident(request)           → POST /api/incidents
 * - getIncidents(request)              → GET /api/incidents
 * - getIncidentById(request)           → GET /api/incidents/:id
 * - updateIncidentStatus(request)      → PUT /api/incidents/:id/status
 * - assignStaff(request)               → POST /api/incidents/:id/assign
 * - acceptIncident(request)            → POST /api/incidents/:id/accept
 * - getAnalytics(request)              → GET /api/analytics
 * - getStaffPerformance(request)       → GET /api/staff/performance
 *
 * ### staffApi.js (StaffAPI namespace)
 * - getStaff(request)                  → GET /api/staff
 * - getStaffById(request)              → GET /api/staff/:id
 * - updateLocation(request)            → PUT /api/staff/:id/location
 * - checkAvailability(request)         → GET /api/staff/:id/availability
 *
 * ============================================================================
 * 3. API FUNCTIONS REFERENCE
 * ============================================================================
 *
 * ### IncidentAPI.createIncident(request)
 *
 * Creates a new emergency incident with automatic staff assignment.
 *
 * Parameters:
 * ```javascript
 * {
 *   title: string,                      // Incident title (required)
 *   description: string,                // Incident description (required)
 *   emergencyType: string,              // Type: 'fire', 'medical', 'security', etc (optional)
 *   user: {                             // Authenticated user (required)
 *     uid: string,                      // User ID (required)
 *     organizationId: string,           // Organization ID (required)
 *     fullName: string,                 // User full name (required)
 *     email: string,                    // User email (optional)
 *     phone: string                     // User phone (optional)
 *   },
 *   latitude: number,                   // GPS latitude (optional)
 *   longitude: number,                  // GPS longitude (optional)
 *   location: {                         // Location details (optional)
 *     building: string,
 *     floor: string,
 *     room: string
 *   }
 * }
 * ```
 *
 * Returns:
 * ```javascript
 * {
 *   success: true/false,
 *   data: {
 *     id: string,
 *     title: string,
 *     status: string,
 *     assignedStaffId: string | null,
 *     createdAt: timestamp,
 *     // ... other incident fields
 *   },
 *   message: string,
 *   error: null | { message, code, details },
 *   code: number,
 *   timestamp: ISO string
 * }
 * ```
 *
 * Example:
 * ```javascript
 * const response = await IncidentAPI.createIncident({
 *   title: 'Building Fire Alert',
 *   description: 'Fire detected in east wing, 3rd floor',
 *   emergencyType: 'Fire',
 *   user: {
 *     uid: 'user-123',
 *     organizationId: 'org-456',
 *     fullName: 'John Doe',
 *     email: 'john@example.com'
 *   },
 *   latitude: 40.7128,
 *   longitude: -74.0060,
 *   location: { building: 'East Wing', floor: '3', room: '301' }
 * })
 * ```
 *
 * ### IncidentAPI.getIncidents(request)
 *
 * Retrieves incidents with optional filtering.
 *
 * Parameters:
 * ```javascript
 * {
 *   organizationId: string,             // Organization ID (required)
 *   userId: string,                     // Filter by reporter (optional)
 *   status: string,                     // Filter by status (optional)
 *   limit: number,                      // Result limit (optional, default 50)
 *   offset: number                      // Pagination offset (optional)
 * }
 * ```
 *
 * Returns:
 * ```javascript
 * {
 *   success: true,
 *   data: {
 *     incidents: Array<Incident>,
 *     count: number,
 *     filters: { organizationId, userId, status }
 *   },
 *   message: string,
 *   code: 200
 * }
 * ```
 *
 * ### IncidentAPI.updateIncidentStatus(request)
 *
 * Updates an incident status (pending → accepted → in_progress → resolved).
 *
 * Parameters:
 * ```javascript
 * {
 *   incidentId: string,                 // Incident ID (required)
 *   status: string,                     // New status (required)
 *   actor: {                            // User performing update (required)
 *     uid: string,
 *     role: 'admin' | 'staff' | 'user',
 *     organizationId: string
 *   }
 * }
 * ```
 *
 * Valid Statuses:
 * - 'pending' - Initial state
 * - 'accepted' - Staff has accepted the incident
 * - 'in_progress' - Work has begun
 * - 'resolved' - Incident has been resolved
 * - 'escalated' - Escalated to higher authority
 * - 'critical' - Critical alert status
 *
 * ### IncidentAPI.assignStaff(request)
 *
 * Manually assigns a staff member to an incident (admin only).
 *
 * Parameters:
 * ```javascript
 * {
 *   incidentId: string,                 // Incident ID (required)
 *   staffId: string,                    // Staff member ID (required)
 *   actor: {                            // Must be admin (required)
 *     uid: string,
 *     role: 'admin',                    // MUST be 'admin'
 *     organizationId: string
 *   }
 * }
 * ```
 *
 * ### IncidentAPI.acceptIncident(request)
 *
 * Staff member accepts an assigned incident.
 *
 * Parameters:
 * ```javascript
 * {
 *   incidentId: string,                 // Incident ID (required)
 *   user: {                             // Accepting staff member (required)
 *     uid: string,
 *     organizationId: string,
 *     fullName: string
 *   }
 * }
 * ```
 *
 * ### IncidentAPI.getAnalytics(request)
 *
 * Retrieves organization-level analytics and KPIs.
 *
 * Parameters:
 * ```javascript
 * {
 *   organizationId: string              // Organization ID (required)
 * }
 * ```
 *
 * Returns:
 * ```javascript
 * {
 *   success: true,
 *   data: {
 *     total_incidents: number,          // Total incidents in org
 *     avg_response_time: number,        // Average response time in minutes
 *     escalation_rate: number,          // Percentage of escalated incidents
 *     resolved_rate: number,            // Percentage resolved
 *     critical_incidents: number        // Count of critical incidents
 *   }
 * }
 * ```
 *
 * ### StaffAPI.getStaff(request)
 *
 * Retrieves all staff members in an organization.
 *
 * Parameters:
 * ```javascript
 * {
 *   organizationId: string              // Organization ID (required)
 * }
 * ```
 *
 * Returns:
 * ```javascript
 * {
 *   success: true,
 *   data: {
 *     staff: Array<StaffMember>,
 *     count: number,
 *     organizationId: string
 *   }
 * }
 * ```
 *
 * ### StaffAPI.updateLocation(request)
 *
 * Updates staff member's current location (for incident assignment).
 *
 * Parameters:
 * ```javascript
 * {
 *   staffId: string,                    // Staff ID (required)
 *   building: string,                   // Building name (optional)
 *   floor: string,                      // Floor number (optional)
 *   actor: {                            // User performing update (optional)
 *     uid: string,
 *     organizationId: string
 *   }
 * }
 * ```
 *
 * ============================================================================
 * 4. STANDARD RESPONSE FORMAT
 * ============================================================================
 *
 * All API endpoints return responses in this standardized format:
 *
 * ```javascript
 * {
 *   success: boolean,                   // Operation success flag
 *   data: any | null,                   // Response data (null on error)
 *   message: string,                    // Human-readable message
 *   error: {                            // Error details (null on success)
 *     message: string,                  // Error message
 *     code: string,                     // Machine-readable error code
 *     details: any                      // Additional error context
 *   } | null,
 *   code: number,                       // HTTP-like status code
 *   timestamp: string                   // ISO timestamp
 * }
 * ```
 *
 * Success Response:
 * ```javascript
 * {
 *   success: true,
 *   data: { id: 'incident-123', status: 'created' },
 *   message: 'Incident created successfully',
 *   error: null,
 *   code: 201,
 *   timestamp: '2026-04-24T10:30:00.000Z'
 * }
 * ```
 *
 * Error Response:
 * ```javascript
 * {
 *   success: false,
 *   data: null,
 *   message: 'User authentication required',
 *   error: {
 *     message: 'User authentication required',
 *     code: 'UNAUTHORIZED',
 *     details: null
 *   },
 *   code: 401,
 *   timestamp: '2026-04-24T10:30:00.000Z'
 * }
 * ```
 *
 * ============================================================================
 * 5. ERROR HANDLING
 * ============================================================================
 *
 * All errors are standardized with machine-readable codes:
 *
 * | Code | HTTP | Description | Resolution |
 * |------|------|-------------|-----------|
 * | UNAUTHORIZED | 401 | Authentication required | Login first |
 * | FORBIDDEN | 403 | Permission denied | Check user role/org |
 * | VALIDATION_ERROR | 422 | Invalid input | Check parameters |
 * | NOT_FOUND | 404 | Resource not found | Verify resource ID |
 * | INCIDENT_CREATE_FAILED | 400 | Failed to create incident | Check input data |
 * | STATUS_UPDATE_FAILED | 400 | Status update failed | Verify status transitions |
 * | ASSIGNMENT_FAILED | 400 | Failed to assign staff | Check staff availability |
 * | STAFF_FETCH_FAILED | 400 | Failed to get staff | Check organization |
 * | ANALYTICS_FAILED | 400 | Failed to compute analytics | Try again later |
 * | INTERNAL_ERROR | 500 | Server error | Contact support |
 *
 * Error Handling in UI:
 * ```javascript
 * const response = await IncidentAPI.createIncident(request)
 *
 * if (!response.success) {
 *   switch (response.error.code) {
 *     case 'UNAUTHORIZED':
 *       // Redirect to login
 *       navigateToLogin()
 *       break
 *     case 'VALIDATION_ERROR':
 *       // Show validation errors
 *       displayValidationErrors(response.error.details)
 *       break
 *     case 'FORBIDDEN':
 *       // Show permission denied
 *       showNotification('You do not have permission')
 *       break
 *     default:
 *       // Generic error
 *       showError(response.error.message)
 *   }
 * }
 * ```
 *
 * ============================================================================
 * 6. AUTHENTICATION & AUTHORIZATION
 * ============================================================================
 *
 * Current Implementation (Firebase):
 * - User authentication via Firebase Auth
 * - Organization-based access control
 * - Role-based permissions: admin, staff, user
 *
 * Required in Requests:
 * - User UID (from Firebase Auth)
 * - Organization ID (from user profile)
 * - User role (from user profile or request context)
 *
 * Authorization Rules:
 * - Anyone can create incidents (in their organization)
 * - Only assigned staff can accept incidents
 * - Only admins can assign staff
 * - Only staff/admin can update status
 * - Only organization members can view organization data
 *
 * Future Backend:
 * - JWT token authentication
 * - OAuth 2.0 / OpenID Connect
 * - API key for external systems
 *
 * ============================================================================
 * 7. INTEGRATION EXAMPLES
 * ============================================================================
 *
 * ### React Component Usage
 *
 * ```javascript
 * import { IncidentAPI } from '@/services/api'
 * import { useUser } from '@/UserContext'
 *
 * function CreateIncidentForm() {
 *   const { user, userData } = useUser()
 *   const [loading, setLoading] = useState(false)
 *   const [error, setError] = useState(null)
 *
 *   const handleCreate = async (formData) => {
 *     setLoading(true)
 *     setError(null)
 *
 *     const response = await IncidentAPI.createIncident({
 *       title: formData.title,
 *       description: formData.description,
 *       emergencyType: formData.type,
 *       user: {
 *         uid: user.uid,
 *         organizationId: userData.organizationId,
 *         fullName: userData.fullName
 *       },
 *       latitude: formData.latitude,
 *       longitude: formData.longitude,
 *       location: formData.location
 *     })
 *
 *     setLoading(false)
 *
 *     if (response.success) {
 *       console.log('Incident created:', response.data.id)
 *       // Navigate to incident details
 *     } else {
 *       setError(response.error.message)
 *     }
 *   }
 *
 *   return (
 *     <form onSubmit={handleCreate}>
 *       {/* Form fields */}
 *     </form>
 *   )
 * }
 * ```
 *
 * ### Dashboard - List Incidents
 *
 * ```javascript
 * import { IncidentAPI } from '@/services/api'
 *
 * function IncidentList() {
 *   const { userData } = useUser()
 *   const [incidents, setIncidents] = useState([])
 *   const [loading, setLoading] = useState(true)
 *
 *   useEffect(() => {
 *     loadIncidents()
 *   }, [])
 *
 *   const loadIncidents = async () => {
 *     const response = await IncidentAPI.getIncidents({
 *       organizationId: userData.organizationId,
 *       status: 'pending'
 *     })
 *
 *     if (response.success) {
 *       setIncidents(response.data.incidents)
 *     }
 *     setLoading(false)
 *   }
 *
 *   return (
 *     <div>
 *       {incidents.map(incident => (
 *         <IncidentCard key={incident.id} incident={incident} />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 *
 * ### External System Integration (IoT/CCTV)
 *
 * ```javascript
 * // External system (e.g., fire detection sensor)
 * import { IncidentAPI } from 'https://resqnet.example.com/api'
 *
 * class AutomatedFireDetection {
 *   async onSmokeDetected(building, floor) {
 *     const response = await IncidentAPI.createIncident({
 *       title: `Smoke Detected - ${building}`,
 *       description: `Automatic detection from smoke detector`,
 *       emergencyType: 'Fire',
 *       user: {
 *         uid: 'system-detector',
 *         organizationId: 'org-headquarters',
 *         fullName: 'Fire Detection System'
 *       },
 *       location: { building, floor }
 *     })
 *
 *     if (response.success) {
 *       console.log('Incident created:', response.data.id)
 *       this.sendAlertToFireDepartment(response.data)
 *     }
 *   }
 * }
 * ```
 *
 * ============================================================================
 * 8. FUTURE BACKEND MIGRATION
 * ============================================================================
 *
 * The API service layer is designed for easy migration to a real backend.
 *
 * Migration Steps:
 *
 * 1. Create Express.js backend with same API endpoints
 * 2. Replace Firebase calls with database queries
 * 3. Move business logic from `utils/` to backend `controllers/`
 * 4. Update UI imports from local services to HTTP client
 * 5. Test API contracts remain identical
 *
 * Before Migration (Current):
 * ```javascript
 * import { IncidentAPI } from '@/services/api/incidentApi'
 * const response = await IncidentAPI.createIncident(request)
 * ```
 *
 * After Migration (Backend):
 * ```javascript
 * import { apiClient } from '@/lib/apiClient'
 * const response = await apiClient.post('/api/incidents', request)
 * // Or with custom wrapper:
 * const response = await IncidentAPI.createIncident(request)
 * // (wrapper makes HTTP calls to backend)
 * ```
 *
 * API remains exactly the same! Only implementation changes.
 *
 * ============================================================================
 * 9. EXTERNAL SYSTEM INTEGRATION
 * ============================================================================
 *
 * ### IoT Sensor Integration
 *
 * ```javascript
 * // IoT device (e.g., temperature sensor)
 * const API_URL = 'https://api.resqnet.example.com'
 *
 * async function handleTemperatureAlert(temp, location) {
 *   if (temp > 80) {
 *     const response = await fetch(`${API_URL}/incidents`, {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({
 *         title: `High Temperature Alert - ${location}`,
 *         description: `Temperature: ${temp}°C`,
 *         emergencyType: 'Fire',
 *         user: {
 *           uid: 'iot-temp-sensor',
 *           organizationId: 'org-123',
 *           fullName: 'Temperature Sensor'
 *         },
 *         location: { building: location }
 *       })
 *     })
 *
 *     const data = await response.json()
 *     console.log('Incident created:', data.data.id)
 *   }
 * }
 * ```
 *
 * ### CCTV System Integration
 *
 * ```javascript
 * // CCTV monitoring system
 * class CCTVIncidentDetector {
 *   async onPersonalInjuryDetected(camera, zone) {
 *     const response = await this.createIncident({
 *       title: `Potential Injury - ${camera}`,
 *       description: `Detected in ${zone}`,
 *       emergencyType: 'Medical',
 *       location: { building: camera }
 *     })
 *   }
 * }
 * ```
 *
 * ============================================================================
 * SUMMARY
 * ============================================================================
 *
 * The API service layer provides:
 *
 * ✅ Clean abstraction between UI and business logic
 * ✅ REST-like API design for external integrations
 * ✅ Standardized request/response format
 * ✅ Comprehensive error handling
 * ✅ Activity logging and monitoring
 * ✅ Ready for backend migration
 * ✅ Support for external system integration
 * ✅ Clear API documentation
 *
 * Next Steps:
 * 1. Update React components to use IncidentAPI
 * 2. Create HTTP client wrapper for future backend
 * 3. Document API endpoints for external systems
 * 4. Build mock backend with Express.js
 * 5. Plan backend migration
 */

export default {}
