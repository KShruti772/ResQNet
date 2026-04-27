## SECURITY API USAGE EXAMPLES

Complete code examples for using the security features.

---

## 1. INPUT VALIDATION EXAMPLES

### Validate Incident Before Submission
```javascript
import { validateIncident, sanitizeUserInput } from '../utils/validationService.js'

// Before sending to Firebase
const handleSubmitIncident = async (formData) => {
  // Sanitize inputs
  const sanitized = {
    title: sanitizeUserInput(formData.title),
    description: sanitizeUserInput(formData.description),
    location: {
      building: sanitizeUserInput(formData.building),
      floor: sanitizeUserInput(formData.floor),
      room: sanitizeUserInput(formData.room)
    }
  }

  // Validate
  const validation = validateIncident(sanitized)
  
  if (!validation.valid) {
    // Show field-level errors
    console.log('Validation errors:', validation.errors)
    // Output: { title: "Title must be at least 3 characters" }
    return
  }

  // Safe to submit
  await createEmergency({
    ...userData,
    ...sanitized
  })
}
```

### Validate Email Before Storage
```javascript
import { validateEmail } from '../utils/validationService.js'

const handleEmailUpdate = (email) => {
  const validation = validateEmail(email)
  
  if (!validation.valid) {
    setError(validation.error) // "Invalid email format"
    return
  }

  // Email is valid
  await updateUserEmail(email)
}
```

### Validate User Profile
```javascript
import { validateUserProfile } from '../utils/validationService.js'

const handleProfileUpdate = (profile) => {
  const validation = validateUserProfile({
    fullName: profile.name,
    email: profile.email,
    phone: profile.phone
  })

  if (!validation.valid) {
    console.log('Profile validation errors:', validation.errors)
    // { email: "Invalid email format", phone: "Invalid phone number format" }
    return
  }

  // All valid
  await updateProfile(profile)
}
```

---

## 2. RATE LIMITING EXAMPLES

### Check Rate Limit Before Creating Incident
```javascript
import { rateLimiter } from '../utils/rateLimitService.js'

const handleCreateIncident = async (incidentData) => {
  // Check rate limit first
  const limitCheck = rateLimiter.isIncidentCreationAllowed(userId)

  if (!limitCheck.allowed) {
    setError(
      `You've created too many incidents. ` +
      `Please wait ${limitCheck.retryAfter} seconds before trying again.`
    )
    return
  }

  // Remaining requests info
  console.log(`You have ${limitCheck.remaining} incidents left to create this hour`)

  // Safe to create
  await createEmergency(incidentData)
}
```

### Check Rate Limit for Updates
```javascript
import { rateLimiter } from '../utils/rateLimitService.js'

const handleUpdateStatus = async (incidentId, newStatus) => {
  const limitCheck = rateLimiter.isIncidentUpdateAllowed(userId)

  if (!limitCheck.allowed) {
    const seconds = limitCheck.retryAfter
    setError(`Rate limited. Retry after ${seconds}s`)
    return
  }

  await updateEmergencyStatus({ incidentId, status: newStatus, actor })
}
```

### Check Login Rate Limit
```javascript
import { rateLimiter } from '../utils/rateLimitService.js'

const handleLogin = async (email, password) => {
  const limitCheck = rateLimiter.isLoginAllowed(email)

  if (!limitCheck.allowed) {
    const minutes = Math.ceil(limitCheck.retryAfter / 60)
    setError(
      `Too many login attempts. Try again in ${minutes} minutes.`
    )
    return
  }

  // Attempt login
  const user = await firebaseAuth.signInWithEmailAndPassword(email, password)
}
```

### Get Rate Limit Stats
```javascript
import { rateLimiter } from '../utils/rateLimitService.js'

const debugRateLimiting = () => {
  const stats = rateLimiter.getStats(userId, 'incident_creation')
  
  console.log('Rate Limit Stats:')
  console.log(`- Used: ${stats.count} of ${stats.limit} requests`)
  console.log(`- Usage: ${stats.usage.toFixed(1)}%`)
  console.log(`- Window: ${stats.window / 1000} seconds`)

  // Output example:
  // - Used: 8 of 10 requests
  // - Usage: 80.0%
  // - Window: 3600 seconds
}
```

---

## 3. SECURE TOKEN MANAGEMENT EXAMPLES

### Store Token on Login
```javascript
import { storeAuthToken } from '../utils/tokenService.js'

const handleLoginSuccess = async (firebaseUser) => {
  // Get ID token from Firebase
  const token = await firebaseUser.getIdToken()
  
  // Store securely (1 hour expiry)
  const stored = storeAuthToken(token, 3600000)
  
  if (stored) {
    console.log('Token stored securely')
    navigateToDashboard()
  }
}
```

### Use Token in API Requests
```javascript
import { attachAuthToken } from '../utils/tokenService.js'

const fetchIncidentsWithAuth = async (organizationId) => {
  const headers = attachAuthToken({
    'Content-Type': 'application/json'
  })

  // Headers now include: Authorization: Bearer <token>
  const response = await fetch(`/api/incidents?org=${organizationId}`, {
    headers
  })

  return response.json()
}
```

### Check Token Validity
```javascript
import { isTokenValid, getTokenTimeRemaining } from '../utils/tokenService.js'

const handlePageLoad = () => {
  if (!isTokenValid()) {
    // Token expired, redirect to login
    navigateToLogin()
    return
  }

  const secondsRemaining = getTokenTimeRemaining()
  if (secondsRemaining < 300) {
    // Less than 5 minutes remaining
    console.warn('Token expiring soon, consider refreshing')
  }

  loadDashboard()
}
```

### Clear Token on Logout
```javascript
import { clearAuthToken } from '../utils/tokenService.js'

const handleLogout = async () => {
  // Sign out from Firebase
  await firebaseAuth.signOut()

  // Clear stored token
  clearAuthToken()

  // Redirect to login
  navigateToLogin()
}
```

### Get Token Info (Safe for Debugging)
```javascript
import { getTokenInfo } from '../utils/tokenService.js'

const debugTokenStatus = () => {
  const info = getTokenInfo()

  console.log('Token Status:')
  console.log(`- Stored: ${info.stored}`)
  console.log(`- Valid: ${info.valid}`)
  console.log(`- Expires in: ${info.expiresIn}s`)
  console.log(`- Format: ${info.format}`) // Shows prefix only, safe

  // Output example:
  // - Stored: true
  // - Valid: true
  // - Expires in: 2847s
  // - Format: eyJhbGciOiJSUzI1Ni...
}
```

---

## 4. ERROR HANDLING EXAMPLES

### Safe Error Display
```javascript
import { getSafeErrorMessage, logErrorSafely } from '../utils/errorHandler.js'

const handleIncidentCreation = async (data) => {
  try {
    await createEmergency(data)
  } catch (error) {
    // Log for debugging (safe)
    logErrorSafely('handleIncidentCreation', error)

    // Display safe message to user
    const userMessage = getSafeErrorMessage(error)
    setError(userMessage)

    // Safe output examples:
    // - Rate limit error → "Too many requests, please try again later"
    // - Validation error → "Invalid input provided"
    // - Permission error → "You do not have permission to perform this action"
  }
}
```

### Handle Specific Error Types
```javascript
import { getSafeErrorMessage, logErrorSafely } from '../utils/errorHandler.js'

const handleStatusUpdate = async (incidentId, status) => {
  try {
    await updateEmergencyStatus({ incidentId, status, actor })
  } catch (error) {
    logErrorSafely('handleStatusUpdate', error)

    // Handle specific errors
    if (error.code === 'RATE_LIMITED') {
      setError(
        `Too many updates. Please wait ${error.retryAfter} seconds.`
      )
    } else if (error.code === 'VALIDATION_ERROR') {
      const errors = Object.values(error.details || {}).join(', ')
      setError(`Invalid input: ${errors}`)
    } else if (error.code === 'permission-denied') {
      setError('You do not have permission to update this incident')
    } else {
      // Generic safe message
      setError(getSafeErrorMessage(error))
    }
  }
}
```

### Log Errors Safely
```javascript
import { logErrorSafely, createErrorResponse } from '../utils/errorHandler.js'

const apiErrorHandler = (error, context) => {
  // Log safely (no sensitive data exposed)
  logErrorSafely(context, error)

  // Create safe API response
  const response = createErrorResponse(
    error.code || 'UNKNOWN_ERROR',
    getSafeErrorMessage(error),
    null // Don't include details in response
  )

  return response
}
```

---

## 5. INTEGRATION WITH DASHBOARD EXAMPLES

### Complete Incident Creation with All Security
```javascript
import { createEmergency } from '../utils/emergencyService.js'
import { validateIncident, sanitizeUserInput } from '../utils/validationService.js'
import { rateLimiter } from '../utils/rateLimitService.js'
import { getSafeErrorMessage, logErrorSafely } from '../utils/errorHandler.js'

const handleCreateIncident = async (formData) => {
  setLoading(true)
  setError('')

  try {
    // 1. Check rate limit
    const rateCheck = rateLimiter.isIncidentCreationAllowed(userId)
    if (!rateCheck.allowed) {
      setError(`Too many incidents. Wait ${rateCheck.retryAfter}s`)
      return
    }

    // 2. Sanitize inputs
    const sanitized = {
      title: sanitizeUserInput(formData.title),
      description: sanitizeUserInput(formData.description),
      location: {
        building: sanitizeUserInput(formData.building),
        floor: sanitizeUserInput(formData.floor),
        room: sanitizeUserInput(formData.room)
      }
    }

    // 3. Validate inputs
    const validation = validateIncident(sanitized)
    if (!validation.valid) {
      setError(`Invalid input: ${Object.values(validation.errors).join(', ')}`)
      return
    }

    // 4. Create incident (emergencyService applies additional checks)
    await createEmergency({
      user: {
        uid: userId,
        organizationId,
        fullName: userName,
        email: userEmail,
        phone: userPhone
      },
      ...sanitized
    })

    // 5. Success
    setToast({ message: 'Incident created successfully', type: 'success' })
    resetForm()

  } catch (error) {
    logErrorSafely('handleCreateIncident', error)

    // Handle different error types
    if (error.code === 'RATE_LIMITED') {
      setError(`Limit exceeded. Wait ${error.retryAfter}s`)
    } else if (error.code === 'VALIDATION_ERROR') {
      setError(`Invalid: ${Object.values(error.details).join(', ')}`)
    } else {
      setError(getSafeErrorMessage(error))
    }

  } finally {
    setLoading(false)
  }
}
```

### Complete Status Update with Security
```javascript
import { updateEmergencyStatus } from '../utils/emergencyService.js'
import { validateStatusUpdate } from '../utils/validationService.js'
import { rateLimiter } from '../utils/rateLimitService.js'
import { getSafeErrorMessage, logErrorSafely } from '../utils/errorHandler.js'

const handleStatusUpdate = async (incidentId, newStatus) => {
  try {
    // 1. Validate status
    const validation = validateStatusUpdate(newStatus)
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    // 2. Check rate limit
    const rateCheck = rateLimiter.isIncidentUpdateAllowed(userId)
    if (!rateCheck.allowed) {
      setError(`Too many updates. Wait ${rateCheck.retryAfter}s`)
      return
    }

    // 3. Update (emergencyService validates auth and role)
    await updateEmergencyStatus({
      emergencyId: incidentId,
      status: newStatus,
      actor: {
        uid: userId,
        role: userRole,
        organizationId: orgId,
        fullName: userName
      }
    })

    setToast({ message: 'Status updated successfully', type: 'success' })

  } catch (error) {
    logErrorSafely('handleStatusUpdate', error)

    if (error.code === 'RATE_LIMITED') {
      setError(`Limit exceeded. Wait ${error.retryAfter}s`)
    } else if (error.message.includes('permission')) {
      setError('You do not have permission to update this incident')
    } else {
      setError(getSafeErrorMessage(error))
    }
  }
}
```

---

## 6. TESTING EXAMPLES

### Unit Test Rate Limiting
```javascript
import { rateLimiter } from '../utils/rateLimitService.js'

describe('Rate Limiting', () => {
  test('should allow requests within limit', () => {
    const result = rateLimiter.isIncidentCreationAllowed('user1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9) // 10 total - 1 used
  })

  test('should block requests exceeding limit', () => {
    // Make 10 requests
    for (let i = 0; i < 10; i++) {
      rateLimiter.isIncidentCreationAllowed('user2')
    }

    // 11th request should be blocked
    const result = rateLimiter.isIncidentCreationAllowed('user2')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfter).toBeGreaterThan(0)
  })
})
```

### Unit Test Validation
```javascript
import { validateIncident } from '../utils/validationService.js'

describe('Input Validation', () => {
  test('should reject short title', () => {
    const result = validateIncident({
      title: 'AB', // Too short
      description: 'This is a valid description'
    })
    expect(result.valid).toBe(false)
    expect(result.errors.title).toContain('at least 3 characters')
  })

  test('should sanitize XSS attempts', () => {
    const result = validateIncident({
      title: '<script>alert("xss")</script>',
      description: 'This is a valid description'
    })
    // Should sanitize or reject
    expect(result.valid).toBe(false)
  })
})
```

---

## PRODUCTION CHECKLIST

Before deploying:

- [ ] Test rate limiting with concurrent users
- [ ] Test input validation with edge cases
- [ ] Test error messages with security team
- [ ] Verify token expiry handling
- [ ] Test logout clears tokens
- [ ] Verify RBAC with different roles
- [ ] Test cross-org access is blocked
- [ ] Load test the entire security stack
- [ ] Review all error messages
- [ ] Enable monitoring and alerts
- [ ] Prepare rollback plan

---

## COMMON ISSUES & SOLUTIONS

### Issue: "Too many requests" error
**Solution:** This is expected when rate limit is exceeded. Tell user to wait:
```javascript
setError(`Please wait ${error.retryAfter} seconds before trying again`)
```

### Issue: "Invalid input" error
**Solution:** Show which fields failed validation:
```javascript
const errors = Object.entries(error.details || {})
  .map(([field, msg]) => `${field}: ${msg}`)
  .join(', ')
setError(`Invalid input: ${errors}`)
```

### Issue: "Permission denied" error
**Solution:** Check user role and organization membership. May need admin approval.

### Issue: Token expired
**Solution:** Redirect to login automatically:
```javascript
if (!isTokenValid()) {
  navigateToLogin()
}
```

---

For more information, see `SECURITY_GUIDE.md`
