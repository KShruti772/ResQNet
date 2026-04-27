/**
 * Mock Express.js Backend - API Implementation Example
 *
 * This file demonstrates how the API service layer would be implemented
 * as a real backend (Node.js + Express.js) in the future.
 *
 * Shows the contract that UI and external systems can rely on.
 *
 * @file mockExpressBackend.js
 * @example
 *
 * DEPLOYMENT NOTE:
 * To migrate to real backend:
 * 1. Move incidentApi.js functions to /api/routes/incidents.js
 * 2. Replace Firebase calls with database queries (MongoDB, PostgreSQL, etc)
 * 3. Deploy as Node.js Express server
 * 4. Update UI imports: from './api' to 'https://api.example.com'
 */

// ============================================================================
// This is PSEUDO-CODE showing Express.js implementation pattern
// ============================================================================

/**
 * Express.js Backend Implementation (Future Migration)
 *
 * ```javascript
 * // backend/app.js
 * import express from 'express'
 * import { authenticate, authorize } from './middleware/auth.js'
 * import * as incidentController from './controllers/incidents.js'
 * import * as staffController from './controllers/staff.js'
 *
 * const app = express()
 *
 * // Middleware
 * app.use(express.json())
 * app.use(authenticate)
 *
 * // ========== INCIDENT ROUTES ==========
 *
 * // POST /api/incidents - Create new incident
 * app.post('/api/incidents', async (req, res) => {
 *   try {
 *     const response = await incidentController.createIncident(req.body)
 *     res.status(response.code).json(response)
 *   } catch (error) {
 *     res.status(500).json({
 *       success: false,
 *       error: { message: 'Server error', code: 'INTERNAL_ERROR' }
 *     })
 *   }
 * })
 *
 * // GET /api/incidents - List incidents
 * app.get('/api/incidents', async (req, res) => {
 *   try {
 *     const response = await incidentController.getIncidents(req.query)
 *     res.status(response.code).json(response)
 *   } catch (error) {
 *     res.status(500).json({
 *       success: false,
 *       error: { message: 'Server error', code: 'INTERNAL_ERROR' }
 *     })
 *   }
 * })
 *
 * // GET /api/incidents/:id - Get single incident
 * app.get('/api/incidents/:id', async (req, res) => {
 *   try {
 *     const response = await incidentController.getIncidentById({
 *       incidentId: req.params.id
 *     })
 *     res.status(response.code).json(response)
 *   } catch (error) {
 *     res.status(500).json({
 *       success: false,
 *       error: { message: 'Server error', code: 'INTERNAL_ERROR' }
 *     })
 *   }
 * })
 *
 * // PUT /api/incidents/:id/status - Update incident status
 * app.put('/api/incidents/:id/status', async (req, res) => {
 *   try {
 *     const response = await incidentController.updateIncidentStatus({
 *       incidentId: req.params.id,
 *       status: req.body.status,
 *       actor: req.user // From auth middleware
 *     })
 *     res.status(response.code).json(response)
 *   } catch (error) {
 *     res.status(500).json({
 *       success: false,
 *       error: { message: 'Server error', code: 'INTERNAL_ERROR' }
 *     })
 *   }
 * })
 *
 * // POST /api/incidents/:id/assign - Assign staff to incident
 * app.post('/api/incidents/:id/assign', authorize('admin'), async (req, res) => {
 *   try {
 *     const response = await incidentController.assignStaff({
 *       incidentId: req.params.id,
 *       staffId: req.body.staffId,
 *       actor: req.user
 *     })
 *     res.status(response.code).json(response)
 *   } catch (error) {
 *     res.status(500).json({
 *       success: false,
 *       error: { message: 'Server error', code: 'INTERNAL_ERROR' }
 *     })
 *   }
 * })
 *
 * // POST /api/incidents/:id/accept - Accept incident
 * app.post('/api/incidents/:id/accept', async (req, res) => {
 *   try {
 *     const response = await incidentController.acceptIncident({
 *       incidentId: req.params.id,
 *       user: req.user
 *     })
 *     res.status(response.code).json(response)
 *   } catch (error) {
 *     res.status(500).json({
 *       success: false,
 *       error: { message: 'Server error', code: 'INTERNAL_ERROR' }
 *     })
 *   }
 * })
 *
 * // GET /api/incidents/organization/:orgId/analytics - Get analytics
 * app.get('/api/incidents/organization/:orgId/analytics', async (req, res) => {
 *   try {
 *     const response = await incidentController.getAnalytics({
 *       organizationId: req.params.orgId
 *     })
 *     res.status(response.code).json(response)
 *   } catch (error) {
 *     res.status(500).json({
 *       success: false,
 *       error: { message: 'Server error', code: 'INTERNAL_ERROR' }
 *     })
 *   }
 * })
 *
 * // ========== STAFF ROUTES ==========
 *
 * // GET /api/staff - List staff
 * app.get('/api/staff', async (req, res) => {
 *   try {
 *     const response = await staffController.getStaff({
 *       organizationId: req.query.organizationId
 *     })
 *     res.status(response.code).json(response)
 *   } catch (error) {
 *     res.status(500).json({
 *       success: false,
 *       error: { message: 'Server error', code: 'INTERNAL_ERROR' }
 *     })
 *   }
 * })
 *
 * // PUT /api/staff/:id/location - Update staff location
 * app.put('/api/staff/:id/location', async (req, res) => {
 *   try {
 *     const response = await staffController.updateLocation({
 *       staffId: req.params.id,
 *       building: req.body.building,
 *       floor: req.body.floor,
 *       actor: req.user
 *     })
 *     res.status(response.code).json(response)
 *   } catch (error) {
 *     res.status(500).json({
 *       success: false,
 *       error: { message: 'Server error', code: 'INTERNAL_ERROR' }
 *     })
 *   }
 * })
 *
 * // GET /api/staff/:id/availability - Check availability
 * app.get('/api/staff/:id/availability', async (req, res) => {
 *   try {
 *     const response = await staffController.checkAvailability({
 *       staffId: req.params.id
 *     })
 *     res.status(response.code).json(response)
 *   } catch (error) {
 *     res.status(500).json({
 *       success: false,
 *       error: { message: 'Server error', code: 'INTERNAL_ERROR' }
 *     })
 *   }
 * })
 *
 * // Start server
 * app.listen(3000, () => console.log('API server running on port 3000'))
 * ```
 *
 * ============================================================================
 * EXTERNAL SYSTEM INTEGRATION EXAMPLE
 * ============================================================================
 *
 * IoT/CCTV System making API calls:
 *
 * ```javascript
 * // iot-system/fireDetector.js
 * import axios from 'axios'
 *
 * const API_BASE_URL = 'http://localhost:3000/api'
 * const IOT_AUTH_TOKEN = process.env.IOT_API_KEY
 *
 * class FireDetectionSystem {
 *   constructor() {
 *     this.api = axios.create({
 *       baseURL: API_BASE_URL,
 *       headers: {
 *         'Authorization': `Bearer ${IOT_AUTH_TOKEN}`,
 *         'Content-Type': 'application/json'
 *       }
 *     })
 *   }
 *
 *   async onFireDetected(building, floor, sensorId) {
 *     try {
 *       console.log(`Fire detected: ${building}, Floor ${floor} (Sensor: ${sensorId})`)
 *
 *       // Create incident via API
 *       const response = await this.api.post('/incidents', {
 *         title: `Fire Detected - ${building}`,
 *         description: `Automatic fire detection from sensor ${sensorId}`,
 *         emergencyType: 'Fire',
 *         user: {
 *           uid: 'iot-fire-system',
 *           organizationId: 'org123',
 *           fullName: 'Fire Detection System'
 *         },
 *         location: { building, floor }
 *       })
 *
 *       if (response.data.success) {
 *         const incidentId = response.data.data.id
 *         console.log(`Incident created: ${incidentId}`)
 *
 *         // Alert external monitoring system
 *         await this.notifyMonitoringCenter(incidentId, building, floor)
 *       } else {
 *         console.error('Failed to create incident:', response.data.error)
 *       }
 *     } catch (error) {
 *       console.error('API error:', error.message)
 *     }
 *   }
 *
 *   async notifyMonitoringCenter(incidentId, building, floor) {
 *     // Send alert to external monitoring center
 *     console.log(`ALERT: Fire incident ${incidentId} in ${building}, Floor ${floor}`)
 *   }
 * }
 *
 * export default new FireDetectionSystem()
 * ```
 *
 * ============================================================================
 * CURRENT IMPLEMENTATION (React + Firebase)
 * ============================================================================
 *
 * The API services are currently implemented as Firebase-backed functions
 * in the React frontend. They follow the same REST-like contract and can
 * be moved to a real backend without changing the API interface.
 *
 * UI Usage:
 * ```javascript
 * import { IncidentAPI } from '@/services/api'
 *
 * // Create incident
 * const response = await IncidentAPI.createIncident({
 *   title: 'Fire in Building A',
 *   description: 'Fire detected on third floor',
 *   emergencyType: 'Fire',
 *   user: currentUser
 * })
 * ```
 *
 * When migrating to backend, simply change imports:
 * ```javascript
 * import { IncidentAPI } from 'https://api.example.com/incidents'
 * // Rest of code remains the same!
 * ```
 */

export default {
    concept: 'Mock Express Backend - Pseudo Implementation',
    status: 'For future reference and migration guide'
}
