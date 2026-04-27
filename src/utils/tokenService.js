/**
 * Secure Token Management Service
 * Handles Firebase Auth tokens and secure storage
 */

const TOKEN_STORAGE_KEY = 'resqnet_auth_token'
const TOKEN_EXPIRY_KEY = 'resqnet_token_expiry'
const REFRESH_THRESHOLD = 5 * 60 * 1000 // Refresh if less than 5 min remaining

/**
 * Store auth token securely (with expiry)
 * @param {string} token - Firebase auth token
 * @param {number} expiresIn - Expiration time in milliseconds
 */
export const storeAuthToken = (token, expiresIn = 3600000) => {
    try {
        const now = Date.now()
        const expiryTime = now + expiresIn

        // Store token
        sessionStorage.setItem(TOKEN_STORAGE_KEY, token)

        // Store expiry timestamp
        sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString())

        return true
    } catch (error) {
        console.error('Failed to store auth token:', error)
        return false
    }
}

/**
 * Retrieve stored auth token
 * @returns {string|null} Token if valid, null if expired or missing
 */
export const getAuthToken = () => {
    try {
        const token = sessionStorage.getItem(TOKEN_STORAGE_KEY)
        const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY)

        if (!token || !expiry) {
            return null
        }

        const expiryTime = parseInt(expiry, 10)
        const now = Date.now()

        // Token expired
        if (now > expiryTime) {
            clearAuthToken()
            return null
        }

        // Token expiring soon - should refresh
        if (expiryTime - now < REFRESH_THRESHOLD) {
            console.warn('Token expiring soon, should refresh')
        }

        return token
    } catch (error) {
        console.error('Failed to retrieve auth token:', error)
        return null
    }
}

/**
 * Clear auth token from storage
 */
export const clearAuthToken = () => {
    try {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY)
        sessionStorage.removeItem(TOKEN_EXPIRY_KEY)
        return true
    } catch (error) {
        console.error('Failed to clear auth token:', error)
        return false
    }
}

/**
 * Check if token is valid and not expired
 */
export const isTokenValid = () => {
    try {
        const token = sessionStorage.getItem(TOKEN_STORAGE_KEY)
        const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY)

        if (!token || !expiry) {
            return false
        }

        const expiryTime = parseInt(expiry, 10)
        const now = Date.now()

        return now < expiryTime
    } catch (error) {
        return false
    }
}

/**
 * Get time remaining until token expiry (in seconds)
 */
export const getTokenTimeRemaining = () => {
    try {
        const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY)
        if (!expiry) return 0

        const expiryTime = parseInt(expiry, 10)
        const now = Date.now()
        const remaining = expiryTime - now

        return remaining > 0 ? Math.ceil(remaining / 1000) : 0
    } catch (error) {
        return 0
    }
}

/**
 * Build Authorization header for API requests
 */
export const getAuthorizationHeader = () => {
    const token = getAuthToken()
    if (!token) {
        return null
    }

    return {
        Authorization: `Bearer ${token}`
    }
}

/**
 * Add auth token to request headers
 */
export const attachAuthToken = (headers = {}) => {
    const authHeader = getAuthorizationHeader()
    if (!authHeader) {
        return headers
    }

    return {
        ...headers,
        ...authHeader
    }
}

/**
 * Validate token format (basic check)
 */
export const isValidTokenFormat = (token) => {
    if (!token || typeof token !== 'string') {
        return false
    }

    // Firebase tokens are typically JWT format: header.payload.signature
    const parts = token.split('.')
    return parts.length === 3 && parts.every(part => part.length > 0)
}

/**
 * Get token info for debugging (without exposing sensitive data)
 */
export const getTokenInfo = () => {
    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY)
    const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY)

    if (!token || !expiry) {
        return { stored: false }
    }

    const expiryTime = parseInt(expiry, 10)
    const now = Date.now()
    const isValid = now < expiryTime
    const remaining = expiryTime - now

    return {
        stored: true,
        valid: isValid,
        expiresIn: remaining > 0 ? Math.ceil(remaining / 1000) : 0,
        format: token.substring(0, 20) + '...' // Only show prefix
    }
}
