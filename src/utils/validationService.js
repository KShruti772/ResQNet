/**
 * Input Validation Service
 * Validates all user inputs before submitting to Firestore
 */

const VALIDATION_RULES = {
    title: {
        minLength: 3,
        maxLength: 200,
        required: true,
        pattern: /^[a-zA-Z0-9\s\-.,!?&()]+$/
    },
    description: {
        minLength: 10,
        maxLength: 5000,
        required: true,
        pattern: /^[a-zA-Z0-9\s\-.,!?&()\n]+$/
    },
    location: {
        building: { minLength: 1, maxLength: 100 },
        floor: { minLength: 0, maxLength: 50 },
        room: { minLength: 0, maxLength: 50 }
    },
    email: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        maxLength: 255
    },
    phone: {
        pattern: /^[\d\s\-+()]+$/,
        minLength: 10,
        maxLength: 20
    },
    priority: {
        enum: ['low', 'medium', 'high'],
        required: true
    },
    status: {
        enum: ['pending', 'accepted', 'in_progress', 'resolved', 'critical', 'escalated'],
        required: true
    }
}

const sanitizeString = (str) => {
    if (typeof str !== 'string') return ''
    return str
        .trim()
        .replace(/[<>]/g, '') // Remove HTML tags
        .slice(0, 5000) // Limit length
}

const validateField = (fieldName, value, rules) => {
    if (!rules) return { valid: true }

    if (rules.required && (!value || value.toString().trim() === '')) {
        return {
            valid: false,
            error: `${fieldName} is required`
        }
    }

    if (typeof value === 'string') {
        const sanitized = sanitizeString(value)

        if (rules.minLength && sanitized.length < rules.minLength) {
            return {
                valid: false,
                error: `${fieldName} must be at least ${rules.minLength} characters`
            }
        }

        if (rules.maxLength && sanitized.length > rules.maxLength) {
            return {
                valid: false,
                error: `${fieldName} cannot exceed ${rules.maxLength} characters`
            }
        }

        if (rules.pattern && !rules.pattern.test(sanitized)) {
            return {
                valid: false,
                error: `${fieldName} contains invalid characters`
            }
        }
    }

    if (rules.enum && !rules.enum.includes(value)) {
        return {
            valid: false,
            error: `${fieldName} must be one of: ${rules.enum.join(', ')}`
        }
    }

    return { valid: true }
}

export const validateIncident = (incident) => {
    const errors = {}

    // Validate title
    const titleValidation = validateField('Title', incident.title, VALIDATION_RULES.title)
    if (!titleValidation.valid) errors.title = titleValidation.error

    // Validate description
    const descValidation = validateField('Description', incident.description, VALIDATION_RULES.description)
    if (!descValidation.valid) errors.description = descValidation.error

    // Validate location
    if (incident.location) {
        if (typeof incident.location === 'object') {
            const buildingValidation = validateField('Building', incident.location.building, { maxLength: 100 })
            if (!buildingValidation.valid) errors.building = buildingValidation.error

            const floorValidation = validateField('Floor', incident.location.floor, { maxLength: 50 })
            if (!floorValidation.valid) errors.floor = floorValidation.error

            const roomValidation = validateField('Room', incident.location.room, { maxLength: 50 })
            if (!roomValidation.valid) errors.room = roomValidation.error
        } else if (typeof incident.location === 'string') {
            const locationValidation = validateField('Location', incident.location, { maxLength: 200 })
            if (!locationValidation.valid) errors.location = locationValidation.error
        }
    }

    // Validate priority if provided
    if (incident.priority) {
        const priorityValidation = validateField('Priority', incident.priority, VALIDATION_RULES.priority)
        if (!priorityValidation.valid) errors.priority = priorityValidation.error
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    }
}

export const validateStatusUpdate = (newStatus) => {
    const statusValidation = validateField('Status', newStatus, VALIDATION_RULES.status)
    if (!statusValidation.valid) {
        return { valid: false, error: statusValidation.error }
    }
    return { valid: true }
}

export const validateEmail = (email) => {
    const emailValidation = validateField('Email', email, VALIDATION_RULES.email)
    return emailValidation
}

export const validatePhone = (phone) => {
    const phoneValidation = validateField('Phone', phone, VALIDATION_RULES.phone)
    return phoneValidation
}

export const sanitizeUserInput = (input) => {
    if (typeof input === 'string') {
        return sanitizeString(input)
    }
    if (typeof input === 'object' && input !== null) {
        const sanitized = {}
        for (const [key, value] of Object.entries(input)) {
            sanitized[key] = sanitizeUserInput(value)
        }
        return sanitized
    }
    return input
}

export const validateUserProfile = (profile) => {
    const errors = {}

    if (profile.fullName) {
        const nameValidation = validateField('Full Name', profile.fullName, {
            minLength: 2,
            maxLength: 100,
            pattern: /^[a-zA-Z\s\-']+$/
        })
        if (!nameValidation.valid) errors.fullName = nameValidation.error
    }

    if (profile.email) {
        const emailValidation = validateField('Email', profile.email, VALIDATION_RULES.email)
        if (!emailValidation.valid) errors.email = emailValidation.error
    }

    if (profile.phone) {
        const phoneValidation = validateField('Phone', profile.phone, VALIDATION_RULES.phone)
        if (!phoneValidation.valid) errors.phone = phoneValidation.error
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    }
}
