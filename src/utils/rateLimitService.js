/**
 * Rate Limiting Service
 * Prevents abuse by limiting request frequency per user/IP
 */

class RateLimiter {
    constructor() {
        this.requests = new Map() // { key: [timestamps] }
        this.limits = {
            login: { requests: 5, window: 15 * 60 * 1000 }, // 5 attempts per 15 min
            incident_creation: { requests: 10, window: 60 * 60 * 1000 }, // 10 per hour
            incident_update: { requests: 50, window: 60 * 60 * 1000 }, // 50 per hour
            api_call: { requests: 100, window: 15 * 60 * 1000 } // 100 per 15 min
        }
    }

    /**
     * Check if action is allowed within rate limit
     * @param {string} key - Unique identifier (userId, IP, or action)
     * @param {string} action - Type of action ('login', 'incident_creation', etc)
     * @returns {object} { allowed: boolean, remaining: number, retryAfter: number }
     */
    checkLimit(key, action = 'api_call') {
        const limit = this.limits[action] || this.limits.api_call
        const now = Date.now()
        const requestKey = `${key}:${action}`

        if (!this.requests.has(requestKey)) {
            this.requests.set(requestKey, [])
        }

        let timestamps = this.requests.get(requestKey)

        // Remove old requests outside the time window
        timestamps = timestamps.filter(timestamp => now - timestamp < limit.window)
        this.requests.set(requestKey, timestamps)

        const allowed = timestamps.length < limit.requests

        if (allowed) {
            timestamps.push(now)
        }

        const remaining = Math.max(0, limit.requests - timestamps.length)
        const oldestRequest = timestamps.length > 0 ? timestamps[0] : now
        const retryAfter = Math.ceil((oldestRequest + limit.window - now) / 1000)

        return {
            allowed,
            remaining,
            retryAfter: retryAfter > 0 ? retryAfter : 0,
            limit: limit.requests,
            window: Math.ceil(limit.window / 1000) // in seconds
        }
    }

    /**
     * Check if user is rate limited for incident creation
     */
    isIncidentCreationAllowed(userId) {
        return this.checkLimit(userId, 'incident_creation')
    }

    /**
     * Check if user is rate limited for incident updates
     */
    isIncidentUpdateAllowed(userId) {
        return this.checkLimit(userId, 'incident_update')
    }

    /**
     * Check if login attempt is allowed
     */
    isLoginAllowed(identifier) {
        return this.checkLimit(identifier, 'login')
    }

    /**
     * Get current usage stats for debugging
     */
    getStats(key, action) {
        const requestKey = `${key}:${action}`
        const timestamps = this.requests.get(requestKey) || []
        const limit = this.limits[action] || this.limits.api_call
        const now = Date.now()

        return {
            count: timestamps.filter(ts => now - ts < limit.window).length,
            limit: limit.requests,
            window: limit.window,
            usage: (timestamps.filter(ts => now - ts < limit.window).length / limit.requests) * 100
        }
    }

    /**
     * Clear old requests to prevent memory leak
     */
    cleanup() {
        const now = Date.now()
        const maxWindow = Math.max(...Object.values(this.limits).map(l => l.window))

        for (const [key, timestamps] of this.requests.entries()) {
            const filtered = timestamps.filter(ts => now - ts < maxWindow)
            if (filtered.length === 0) {
                this.requests.delete(key)
            } else {
                this.requests.set(key, filtered)
            }
        }
    }
}

// Export singleton instance
export const rateLimiter = new RateLimiter()

// Cleanup every 5 minutes
setInterval(() => {
    rateLimiter.cleanup()
}, 5 * 60 * 1000)

export default rateLimiter
