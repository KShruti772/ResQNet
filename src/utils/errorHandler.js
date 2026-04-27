/**
 * Secure Error Handler
 * Returns safe error messages without exposing sensitive data
 */

export const ERROR_MESSAGES = {
    // Authentication errors
    AUTH_REQUIRED: 'Authentication required',
    AUTH_FAILED: 'Authentication failed',
    TOKEN_EXPIRED: 'Session expired, please log in again',
    TOKEN_INVALID: 'Invalid session token',
    PERMISSION_DENIED: 'You do not have permission to perform this action',

    // Validation errors
    INVALID_INPUT: 'Invalid input provided',
    MISSING_REQUIRED_FIELD: 'Required field is missing',
    INVALID_EMAIL: 'Invalid email format',
    INVALID_PHONE: 'Invalid phone number format',

    // Rate limiting
    RATE_LIMITED: 'Too many requests, please try again later',
    LOGIN_RATE_LIMITED: 'Too many login attempts, please try again in a few minutes',
    INCIDENT_CREATION_RATE_LIMITED: 'You have created too many incidents recently, please wait before creating another',
    OFFLINE_QUEUED: 'Offline — alert has been queued and will retry when connection returns',

    // Resource errors
    RESOURCE_NOT_FOUND: 'The requested resource was not found',
    RESOURCE_ALREADY_EXISTS: 'This resource already exists',

    // Organization errors
    ORG_NOT_FOUND: 'Organization not found or not accessible',
    ORG_SETUP_REQUIRED: 'Organization setup is required before proceeding',

    // Incident errors
    INCIDENT_NOT_FOUND: 'Incident not found',
    INCIDENT_ALREADY_ASSIGNED: 'This incident has already been assigned',
    INCIDENT_NOT_PENDING: 'Only pending incidents can be accepted',
    INVALID_STATUS_TRANSITION: 'Invalid status transition',

    // Staff errors
    STAFF_NOT_FOUND: 'Staff member not found',
    STAFF_NOT_AVAILABLE: 'Selected staff member is not available',

    // General errors
    NETWORK_ERROR: 'Network error, please check your connection',
    SERVER_ERROR: 'An error occurred, please try again later',
    UNKNOWN_ERROR: 'An unexpected error occurred'
}

/**
 * Get safe error message from Firebase error
 */
export const getSafeErrorMessage = (error) => {
    if (!error) {
        return ERROR_MESSAGES.UNKNOWN_ERROR
    }

    // Handle Firebase Auth errors
    if (error.code) {
        const codeMap = {
            'auth/user-not-found': ERROR_MESSAGES.AUTH_FAILED,
            'auth/wrong-password': ERROR_MESSAGES.AUTH_FAILED,
            'auth/invalid-email': ERROR_MESSAGES.INVALID_EMAIL,
            'auth/email-already-in-use': ERROR_MESSAGES.RESOURCE_ALREADY_EXISTS,
            'auth/weak-password': 'Password is too weak',
            'auth/too-many-requests': ERROR_MESSAGES.LOGIN_RATE_LIMITED,
            'permission-denied': ERROR_MESSAGES.PERMISSION_DENIED,
            'not-found': ERROR_MESSAGES.RESOURCE_NOT_FOUND,
            'unauthenticated': ERROR_MESSAGES.AUTH_REQUIRED
        }

        if (codeMap[error.code]) {
            return codeMap[error.code]
        }
    }

    // Handle custom error messages
    if (error.message) {
        const message = error.message.toLowerCase()

        if (message.includes('rate limit')) {
            return ERROR_MESSAGES.RATE_LIMITED
        }
        if (message.includes('permission')) {
            return ERROR_MESSAGES.PERMISSION_DENIED
        }
        if (message.includes('not found')) {
            return ERROR_MESSAGES.RESOURCE_NOT_FOUND
        }
        if (message.includes('offline') || message.includes('queued')) {
            return ERROR_MESSAGES.OFFLINE_QUEUED
        }
        if (message.includes('network')) {
            return ERROR_MESSAGES.NETWORK_ERROR
        }
    }

    return ERROR_MESSAGES.SERVER_ERROR
}

/**
 * Log error safely (for debugging)
 */
export const logErrorSafely = (context, error) => {
    if (!error) return

    const safeError = {
        context,
        message: error.message || 'Unknown error',
        code: error.code || 'UNKNOWN',
        timestamp: new Date().toISOString()
    }

    // Don't log sensitive data
    if (error.stack) {
        safeError.stack = error.stack.split('\n').slice(0, 3).join('\n')
    }

    console.error('[Security Error]', safeError)

    // In production, could send to error tracking service
    // e.g., Sentry, LogRocket, etc.
}

/**
 * Handle unauthorized access
 */
export const handleUnauthorized = (context, callback) => {
    console.warn(`[Security] Unauthorized access attempt: ${context}`)

    // Call optional callback (e.g., logout, redirect)
    if (typeof callback === 'function') {
        callback()
    }
}

/**
 * Handle rate limit exceeded
 */
export const handleRateLimitExceeded = (retryAfter) => {
    const seconds = Math.ceil(retryAfter)
    console.warn(`[Security] Rate limited, retry after ${seconds}s`)

    return {
        message: ERROR_MESSAGES.RATE_LIMITED,
        retryAfter: seconds,
        retryAt: new Date(Date.now() + retryAfter * 1000)
    }
}

/**
 * Sanitize error for display (remove stack traces, sensitive data)
 */
export const sanitizeErrorForDisplay = (error) => {
    const message = getSafeErrorMessage(error)

    return {
        message,
        userFriendly: true,
        timestamp: new Date().toISOString()
    }
}

/**
 * Create error object for API responses
 */
export const createErrorResponse = (code, message, details = null) => {
    return {
        error: true,
        code,
        message: message || ERROR_MESSAGES.UNKNOWN_ERROR,
        details: details || null,
        timestamp: new Date().toISOString()
    }
}

/**
 * Check if error is recoverable
 */
export const isRecoverableError = (error) => {
    if (!error || !error.code) return false

    const recoverableCodes = [
        'auth/too-many-requests',
        'network-error',
        'service-unavailable'
    ]

    return recoverableCodes.includes(error.code)
}
