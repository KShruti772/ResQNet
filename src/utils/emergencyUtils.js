// Utility functions for emergency system
export const normalizeOrganizationId = (organizationId = '') => {
    return organizationId.trim().toLowerCase().replace(/\s+/g, '_')
}

export const normalizeEmergencyStatus = (status = 'pending') => {
    const normalized = String(status).trim().toLowerCase()

    if (normalized === 'in progress') {
        return 'in_progress'
    }

    return normalized || 'pending'
}

export const formatEmergencyStatus = (status = 'pending') => {
    const normalized = normalizeEmergencyStatus(status)

    if (normalized === 'in_progress') {
        return 'In Progress'
    }

    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export const getPriority = (emergencyType) => {
    const type = typeof emergencyType === 'string'
        ? emergencyType
        : emergencyType?.emergencyType || emergencyType?.type

    const priorities = {
        'Fire': 'High',
        'Medical': 'High',
        'Security': 'Medium',
        'General': 'Low'
    }
    return priorities[type] || 'Low'
}

export const getPriorityColor = (priority) => {
    const colors = {
        'High': 'text-red-300 bg-red-500/10',
        'Medium': 'text-yellow-300 bg-yellow-500/10',
        'Low': 'text-green-300 bg-green-500/10'
    }
    return colors[priority] || 'text-slate-300'
}

/**
 * Safely extracts timestamp in milliseconds from various date formats
 * Handles Firestore timestamps, Date objects, strings, and null/undefined
 * @param {any} dateValue - The date value to extract timestamp from
 * @returns {number} - Timestamp in milliseconds, or 0 if invalid
 */
export const safeGetTimestamp = (dateValue) => {
    if (!dateValue) return 0

    // Firestore timestamp object
    if (typeof dateValue === 'object' && typeof dateValue.seconds === 'number') {
        return dateValue.seconds * 1000 + (dateValue.nanoseconds || 0) / 1000000
    }

    // Date object
    if (dateValue instanceof Date) {
        return dateValue.getTime()
    }

    // String or number
    if (typeof dateValue === 'string' || typeof dateValue === 'number') {
        const parsed = new Date(dateValue)
        return isNaN(parsed.getTime()) ? 0 : parsed.getTime()
    }

    return 0
}

/**
 * Enhanced priority color with pattern detection highlighting
 * @param {string} priority - Incident priority (high, medium, low)
 * @param {boolean} patternDetected - Whether pattern was detected
 * @returns {string} Tailwind CSS classes
 */
export const getEnhancedPriorityColor = (priority, patternDetected = false) => {
    const baseColors = {
        'high': 'text-red-300 bg-red-500/10',
        'medium': 'text-yellow-300 bg-yellow-500/10',
        'low': 'text-green-300 bg-green-500/10'
    }

    const baseColor = baseColors[priority?.toLowerCase()] || baseColors['medium']

    // Add pattern detection highlighting
    if (patternDetected) {
        return `${baseColor} ring-2 ring-orange-400/50 ring-offset-1 ring-offset-slate-900`
    }

    return baseColor
}

export const getResponseTime = (createdAt) => {
    if (!createdAt) return 'Unknown'
    const now = Date.now()
    const created = createdAt.seconds ? createdAt.seconds * 1000 : createdAt
    const diffMinutes = Math.floor((now - created) / 60000)
    return `${diffMinutes} min`
}

export const playAlertSound = () => {
    try {
        // Create a simple alert sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.5)
    } catch (error) {
        console.log('Audio not supported')
    }
}

export const getStatusSteps = () => [
    { key: 'pending', label: 'Pending', color: 'bg-yellow-500' },
    { key: 'assigned', label: 'Assigned', color: 'bg-sky-500' },
    { key: 'accepted', label: 'Accepted', color: 'bg-blue-500' },
    { key: 'critical', label: 'Critical', color: 'bg-red-500' },
    { key: 'in_progress', label: 'In Progress', color: 'bg-orange-500' },
    { key: 'resolved', label: 'Resolved', color: 'bg-emerald-500' }
]

export const getCurrentStatusIndex = (status) => {
    const steps = getStatusSteps()
    return steps.findIndex(step => step.key === normalizeEmergencyStatus(status))
}

export const formatEventType = (eventType) => {
    const formatted = {
        'CREATED': 'Created',
        'ASSIGNED': 'Assigned',
        'ACCEPTED': 'Accepted',
        'ESCALATED': 'Escalated',
        'RESOLVED': 'Resolved'
    }
    return formatted[eventType] || String(eventType).trim()
}

export const formatEventTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time'
    const ts = timestamp.seconds ? timestamp.seconds * 1000 : timestamp
    const date = new Date(ts)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export const getEventIcon = (eventType) => {
    const icons = {
        'CREATED': '📝',
        'ASSIGNED': '👤',
        'ACCEPTED': '✅',
        'ESCALATED': '⬆️',
        'RESOLVED': '🎉'
    }
    return icons[eventType] || '•'
}
