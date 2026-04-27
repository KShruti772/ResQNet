/**
 * Smart Assignment Service
 * Implements intelligent staff assignment based on workload, skills, and performance
 */

import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase.js'

/**
 * Calculate assignment score for a staff member
 * Enhanced with location-based priority matching
 * @param {Object} staff - Staff member data
 * @param {Object} incident - Incident data
 * @returns {number} Assignment score
 */
const calculateAssignmentScore = (staff, incident) => {
    // Location matching (40 points max) - HIGHEST PRIORITY
    const locationMatch = calculateLocationMatch(staff, incident)
    const locationScore = locationMatch * 40

    // Skill matching (30 points max)
    const skillMatch = hasRequiredSkill(staff, incident) ? 1 : 0
    const skillScore = skillMatch * 30

    // Workload factor (20 points max)
    const workload = staff.currentActiveIncidents || staff.active_incidents_count || 0
    const workloadScore = (1 / (1 + workload)) * 20

    // Performance factor (10 points max)
    const avgResponseTime = staff.avgResponseTime || staff.avg_response_time || 300 // default 5 minutes
    const performanceScore = Math.min(10, 10 / Math.max(avgResponseTime, 1))

    const totalScore = locationScore + skillScore + workloadScore + performanceScore

    return {
        score: totalScore,
        breakdown: {
            locationMatch,
            locationScore,
            skillMatch,
            skillScore,
            workload,
            workloadScore,
            avgResponseTime,
            performanceScore
        }
    }
}

/**
 * Calculate location match score (0-1)
 * Prioritizes same floor > same building > different location
 * @param {Object} staff - Staff member data
 * @param {Object} incident - Incident data
 * @returns {number} Location match score (0-1)
 */
const calculateLocationMatch = (staff, incident) => {
    const staffLocation = staff.current_location || staff.currentLocation || {}
    const incidentLocation = incident.locationDetails || incident.location || {}

    const staffBuilding = String(staffLocation.building || '').trim().toLowerCase()
    const staffFloor = String(staffLocation.floor || '').trim().toLowerCase()
    const incidentBuilding = String(incidentLocation.building || '').trim().toLowerCase()
    const incidentFloor = String(incidentLocation.floor || '').trim().toLowerCase()

    // Perfect match: same floor (highest priority)
    if (staffFloor && incidentFloor && staffFloor === incidentFloor) {
        return 1.0
    }

    // Good match: same building, different floor
    if (staffBuilding && incidentBuilding && staffBuilding === incidentBuilding) {
        return 0.7
    }

    // Basic match: has location data but different building
    if ((staffBuilding || staffFloor) && (incidentBuilding || incidentFloor)) {
        return 0.3
    }

    // No location data available
    return 0.1
}

/**
 * Check if staff has required skill for incident
 * @param {Object} staff - Staff member data
 * @param {Object} incident - Incident data
 * @returns {boolean} Whether staff has required skill
 */
const hasRequiredSkill = (staff, incident) => {
    const incidentType = String(incident.emergencyType || incident.type || 'general').toLowerCase().trim()
    const staffSkills = Array.isArray(staff.skills) ? staff.skills.map(s => String(s).toLowerCase().trim()) : []

    // Direct skill match
    if (staffSkills.includes(incidentType)) {
        return true
    }

    // Handle common mappings
    const skillMappings = {
        'fire': ['emergency', 'safety'],
        'medical': ['emergency', 'health'],
        'security': ['emergency', 'safety'],
        'general': ['emergency'] // general incidents can be handled by emergency-trained staff
    }

    const mappedSkills = skillMappings[incidentType] || []
    return mappedSkills.some(skill => staffSkills.includes(skill))
}

/**
 * Get the best staff member for an incident using smart assignment
 * @param {Object} incident - Incident data with organizationId and emergencyType
 * @returns {Promise<Object|null>} Best staff member or null if none available
 */
export const getBestStaff = async (incident) => {
    try {
        if (!incident?.organizationId) {
            console.warn('Cannot assign staff: missing organization ID')
            return null
        }

        // Fetch all available staff for the organization
        const staffQuery = query(
            collection(db, 'users'),
            where('organizationId', '==', incident.organizationId),
            where('role', '==', 'staff')
        )

        const staffSnapshot = await getDocs(staffQuery)
        const allStaff = staffSnapshot.docs.map((docSnapshot) => ({ uid: docSnapshot.id, ...docSnapshot.data() }))

        // Filter available staff only
        const availableStaff = allStaff.filter(staff => {
            const availability = String(staff.availability_status || staff.availabilityStatus || '').trim().toLowerCase()
            return !availability || availability === 'available'
        })

        if (availableStaff.length === 0) {
            console.warn('No available staff found for organization:', incident.organizationId)
            return null
        }

        // Calculate scores for all available staff
        const staffWithScores = availableStaff.map(staff => ({
            ...staff,
            assignmentScore: calculateAssignmentScore(staff, incident)
        }))

        const hasSkilledStaff = staffWithScores.some((staff) => staff.assignmentScore.breakdown.skillMatch === 1)

        let bestStaff = null
        if (hasSkilledStaff) {
            staffWithScores.sort((a, b) => b.assignmentScore.score - a.assignmentScore.score)
            bestStaff = staffWithScores[0]
        } else {
            // Fallback to existing location-based/available selection when no skill match exists
            bestStaff = getFallbackStaff(availableStaff, incident.locationDetails || {})
        }

        // Log assignment decision for audit
        console.log('Smart assignment decision:', {
            incidentId: incident.id,
            incidentType: incident.emergencyType || incident.type,
            bestStaff: bestStaff ? {
                uid: bestStaff.uid,
                fullName: bestStaff.fullName || bestStaff.displayName,
                score: bestStaff.assignmentScore?.score,
                breakdown: bestStaff.assignmentScore?.breakdown
            } : null,
            totalCandidates: staffWithScores.length
        })

        return bestStaff

    } catch (error) {
        console.error('Smart assignment failed:', error)
        return null
    }
}

/**
 * Fallback to location-based assignment (enhanced with better location matching)
 * @param {Array} staffUsers - Array of staff users
 * @param {Object} incidentLocation - Incident location data
 * @returns {Object|null} Best staff based on location proximity
 */
export const getFallbackStaff = (staffUsers = [], incidentLocation = {}) => {
    const targetBuilding = String(incidentLocation?.building || '').trim().toLowerCase()
    const targetFloor = String(incidentLocation?.floor || '').trim().toLowerCase()

    return [...staffUsers]
        .filter(staff => {
            const availability = String(staff.availability_status || staff.availabilityStatus || '').trim().toLowerCase()
            return !availability || availability === 'available'
        })
        .sort((a, b) => {
            // Calculate location match scores
            const aLocationScore = calculateLocationMatch(a, { locationDetails: incidentLocation })
            const bLocationScore = calculateLocationMatch(b, { locationDetails: incidentLocation })

            // Higher location score gets priority
            if (aLocationScore !== bLocationScore) {
                return bLocationScore - aLocationScore
            }

            // Then by workload
            const countA = getStaffLoad(a)
            const countB = getStaffLoad(b)

            if (countA !== countB) {
                return countA - countB
            }

            // Finally by ID for consistency
            return String(a.uid || a.id || '').localeCompare(String(b.uid || b.id || ''))
        })[0] || null
}

// Helper functions (duplicated from emergencyService.js for independence)
const getStaffCurrentFloor = (staffUser = {}) => {
    const currentLocation = staffUser.current_location || staffUser.currentLocation || {}
    return String(currentLocation.floor || '').trim().toLowerCase()
}

const getStaffLoad = (staffUser = {}) => {
    return Number(staffUser.active_incidents_count ?? staffUser.activeIncidentsCount ?? 0) || 0
}
