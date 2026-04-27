/**
 * Standard Response Builder for API Endpoints
 *
 * Provides consistent response format across all API endpoints.
 * All API functions should return responses in this format.
 *
 * @example
 * return ApiResponse.success({ id: '123', status: 'created' })
 * return ApiResponse.error('Emergency not found', 'NOT_FOUND')
 */

export const ApiResponse = {
    /**
     * Build a success response
     * @param {any} data - Response data payload
     * @param {string} message - Optional success message
     * @returns {{ success: true, data, message, error: null, code: 200 }}
     */
    success(data, message = 'Operation successful') {
        return {
            success: true,
            data: data || null,
            message,
            error: null,
            code: 200,
            timestamp: new Date().toISOString()
        }
    },

    /**
     * Build a created response
     * @param {any} data - Created resource data
     * @param {string} message - Optional message
     * @returns {{ success: true, data, code: 201 }}
     */
    created(data, message = 'Resource created successfully') {
        return {
            success: true,
            data,
            message,
            error: null,
            code: 201,
            timestamp: new Date().toISOString()
        }
    },

    /**
     * Build an error response
     * @param {string} message - Error message (user-friendly)
     * @param {string} code - Error code (machine-friendly)
     * @param {number} statusCode - HTTP status code
     * @param {any} details - Additional error details (debug info)
     * @returns {{ success: false, data: null, error: { message, code, details }, code: statusCode }}
     */
    error(message, code = 'INTERNAL_ERROR', statusCode = 400, details = null) {
        return {
            success: false,
            data: null,
            message,
            error: {
                message: message || 'An error occurred',
                code: code || 'INTERNAL_ERROR',
                details: details || null
            },
            code: statusCode,
            timestamp: new Date().toISOString()
        }
    },

    /**
     * Build a not found error response
     * @param {string} resourceType - Type of resource not found
     * @param {string} id - ID of missing resource
     * @returns {object} Error response with 404 code
     */
    notFound(resourceType, id) {
        return this.error(
            `${resourceType} with ID '${id}' not found`,
            'NOT_FOUND',
            404
        )
    },

    /**
     * Build an unauthorized error response
     * @param {string} message - Optional custom message
     * @returns {object} Error response with 401 code
     */
    unauthorized(message = 'Authentication required') {
        return this.error(message, 'UNAUTHORIZED', 401)
    },

    /**
     * Build a forbidden error response
     * @param {string} message - Optional custom message
     * @returns {object} Error response with 403 code
     */
    forbidden(message = 'You do not have permission to perform this action') {
        return this.error(message, 'FORBIDDEN', 403)
    },

    /**
     * Build a validation error response
     * @param {string|object} errors - Validation error(s)
     * @returns {object} Error response with 422 code
     */
    validationError(errors) {
        return this.error(
            'Validation failed',
            'VALIDATION_ERROR',
            422,
            errors
        )
    }
}
