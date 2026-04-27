# Enterprise-Level Security Implementation

## Overview
This document outlines the security enhancements implemented in the emergency response system to meet production standards.

---

## 1. INPUT VALIDATION & SANITIZATION

### Service: `src/utils/validationService.js`

**Features:**
- Validates incident title, description, location fields
- Checks for email and phone number formats
- Prevents XSS attacks through input sanitization
- Enforces field length limits
- Validates enums (status, priority, role)

**Usage:**
```javascript
import { validateIncident, sanitizeUserInput } from '../utils/validationService.js'

const validation = validateIncident({
  title: userInput.title,
  description: userInput.description,
  location: userInput.location
})

if (!validation.valid) {
  // Handle validation errors
  console.log(validation.errors)
}

const safe = sanitizeUserInput(userInput)
```

**Validation Rules:**
- Title: 3-200 characters, alphanumeric + basic punctuation
- Description: 10-5000 characters
- Email: Valid email format
- Phone: 10-20 digits, supports + and dashes
- Status: Must be one of ['pending', 'accepted', 'in_progress', 'resolved', 'critical', 'escalated']

---

## 2. RATE LIMITING

### Service: `src/utils/rateLimitService.js`

**Features:**
- Prevents brute force attacks (login rate limiting)
- Limits incident creation (10 per hour per user)
- Limits incident updates (50 per hour per user)
- Automatic cleanup to prevent memory leaks

**Usage:**
```javascript
import { rateLimiter } from '../utils/rateLimitService.js'

const check = rateLimiter.isIncidentCreationAllowed(userId)
if (!check.allowed) {
  console.log(`Rate limited. Retry after ${check.retryAfter}s`)
}
```

**Limits:**
| Action | Requests | Window |
|--------|----------|--------|
| Login | 5 | 15 min |
| Incident Creation | 10 | 1 hour |
| Incident Update | 50 | 1 hour |
| API Calls | 100 | 15 min |

---

## 3. ROLE-BASED ACCESS CONTROL (RBAC)

### Firebase Firestore Rules: `firestore.rules`

**Roles:**
- `user`: Can create incidents (self only)
- `staff`: Can accept and update incidents
- `admin`: Can manage all incidents and staff

**Access Control:**
- Users can only create incidents in their own organization
- Staff/Admins can view all incidents in their organization
- Only incident creator or assigned staff can update incident status
- Admins can reassign incidents and view analytics

**Firestore Rules Enhancements:**
- Email validation on user creation
- Status must be valid enum value
- Incident data requires all mandatory fields
- Cross-organization access is blocked

---

## 4. SECURE TOKEN MANAGEMENT

### Service: `src/utils/tokenService.js`

**Features:**
- Stores Firebase auth tokens securely in sessionStorage
- Auto-expires tokens
- Prevents token reuse after expiration
- Provides safe token info for debugging

**Usage:**
```javascript
import { storeAuthToken, getAuthToken, isTokenValid, attachAuthToken } from '../utils/tokenService.js'

// Store token from Firebase Auth
storeAuthToken(firebaseToken, 3600000) // 1 hour

// Use in API requests
const headers = attachAuthToken()
// Returns: { Authorization: 'Bearer <token>' }

// Check if token is still valid
if (isTokenValid()) {
  // Token is good
}
```

**Token Lifecycle:**
1. Generated on login via Firebase Auth
2. Stored in sessionStorage with expiry timestamp
3. Auto-clears on expiry
4. Refreshes if less than 5 minutes remaining

---

## 5. ERROR HANDLING & LOGGING

### Service: `src/utils/errorHandler.js`

**Features:**
- Returns safe error messages without exposing sensitive data
- Logs errors safely for debugging
- Maps Firebase error codes to user-friendly messages
- Identifies recoverable vs. fatal errors

**Usage:**
```javascript
import { getSafeErrorMessage, logErrorSafely } from '../utils/errorHandler.js'

try {
  // Operation
} catch (error) {
  logErrorSafely('operation_context', error)
  const message = getSafeErrorMessage(error)
  // Display to user
}
```

**Safe Error Messages:**
- Auth errors: "Authentication failed"
- Rate limits: "Too many requests, please try again later"
- Permission denied: "You do not have permission to perform this action"
- Validation: "Invalid input provided"

---

## 6. INTEGRATION WITH INCIDENT SERVICE

### File: `src/utils/emergencyService.js`

**Security Enhancements:**

#### createEmergency()
- ✅ Validates user authentication
- ✅ Checks rate limit (10 per hour)
- ✅ Validates incident data
- ✅ Sanitizes all string inputs
- ✅ Rejects invalid status transitions

#### updateEmergencyStatus()
- ✅ Validates authentication
- ✅ Checks rate limit (50 per hour)
- ✅ Validates status enum
- ✅ Enforces RBAC (admin or assigned staff only)
- ✅ Verifies organization membership

#### assignEmergencyToStaff()
- ✅ Admin-only operation
- ✅ Validates organization membership
- ✅ Sends notifications with safe data

---

## 7. FRONTEND SECURITY PRACTICES

### User Dashboard (`src/pages/UserDashboard.jsx`)

**Implemented:**
- Input validation before submission
- Rate limit error handling
- Safe error messages
- Token-based authentication headers
- Session timeout handling

**Error Handling Example:**
```javascript
try {
  await createEmergency(data)
} catch (error) {
  if (error.code === 'RATE_LIMITED') {
    setError(`Too many incidents. Wait ${error.retryAfter}s`)
  } else if (error.code === 'VALIDATION_ERROR') {
    setError(`Invalid input: ${Object.values(error.details).join(', ')}`)
  } else {
    setError(getSafeErrorMessage(error))
  }
}
```

---

## 8. ENVIRONMENTAL VARIABLES

Required environment variables for optional features:

```
# Email notifications (optional)
VITE_EMAIL_WEBHOOK_URL=https://your-webhook-url.com/send-email
VITE_NOTIFICATION_ADMIN_EMAIL=admin@organization.com

# OpenAI for incident analysis (optional)
VITE_OPENAI_API_KEY=sk-...

# Firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

---

## 9. SECURITY BEST PRACTICES

### Client-Side
✅ Never store sensitive data in localStorage (use sessionStorage for tokens)
✅ Always validate input before submission
✅ Check rate limits before API calls
✅ Handle 401/403 errors by redirecting to login
✅ Use HTTPS in production
✅ Clear tokens on logout

### Server-Side (Firestore)
✅ Firestore rules enforce authentication
✅ Role-based access control via Firestore rules
✅ Input validation at database level
✅ Cross-organization access blocked
✅ Status enum validation
✅ Required field validation

### Error Handling
✅ Never expose stack traces to users
✅ Never expose database structure
✅ Never expose user passwords/tokens
✅ Log errors safely for debugging
✅ Return generic messages for unknown errors

---

## 10. TESTING RATE LIMITS

```javascript
import { rateLimiter } from './src/utils/rateLimitService.js'

// Simulate incident creation rate limit
for (let i = 0; i < 11; i++) {
  const check = rateLimiter.isIncidentCreationAllowed('user123')
  console.log(`Attempt ${i + 1}:`, check.allowed ? 'OK' : 'BLOCKED')
}

// Check stats
const stats = rateLimiter.getStats('user123', 'incident_creation')
console.log(`Usage: ${stats.usage}%`)
```

---

## 11. DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] Enable HTTPS for all traffic
- [ ] Set strong Firebase security rules (see firestore.rules)
- [ ] Configure rate limiting in Cloud Functions (if using)
- [ ] Enable audit logging in Firestore
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Implement CORS headers on API endpoints
- [ ] Test all validation rules
- [ ] Test rate limiting thresholds
- [ ] Review Firestore rules in security console
- [ ] Disable debug logging in production
- [ ] Set secure cookie flags (SameSite, HttpOnly)
- [ ] Implement CSP headers
- [ ] Enable two-factor authentication for admins

---

## 12. MONITORING & ALERTING

Recommended monitoring:
- Failed authentication attempts
- Rate limit violations
- Validation errors
- Permission denials
- Unusual incident creation patterns
- API error rates

---

## 13. FUTURE ENHANCEMENTS

Optional security improvements:
- [ ] Implement JWT token refresh flow
- [ ] Add IP-based rate limiting
- [ ] Implement request signing
- [ ] Add webhook signature verification
- [ ] Implement field-level encryption
- [ ] Add audit trail for all operations
- [ ] Implement bot detection
- [ ] Add API key management for third-party integrations

---

## Support & Questions

For security issues, contact the security team immediately.
Do not commit security findings to public repositories.
