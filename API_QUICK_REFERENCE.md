# API Service Layer - Quick Reference

## Overview

The ResQNet application uses a clean, reusable API service layer that separates business logic from UI components. This design allows for easy testing, code reuse, and **future migration to a real backend without changing UI code**.

## Quick Start

### Using the API in React Components

```javascript
import { apiClient } from '@/services/api'
import { useUser } from '@/UserContext'

function MyComponent() {
  const { user, userData } = useUser()

  const handleCreateIncident = async () => {
    const response = await apiClient.incidents.create({
      title: 'Fire in Building A',
      description: 'Fire detected on third floor',
      emergencyType: 'Fire',
      user: {
        uid: user.uid,
        organizationId: userData.organizationId,
        fullName: userData.fullName
      }
    })

    if (response.success) {
      console.log('Incident created:', response.data.id)
    } else {
      console.error('Error:', response.error.message)
    }
  }

  return <button onClick={handleCreateIncident}>Create Incident</button>
}
```

## API Functions

### Incidents

#### Create Incident
```javascript
const response = await apiClient.incidents.create({
  title: string,
  description: string,
  emergencyType?: string,
  user: { uid, organizationId, fullName },
  latitude?: number,
  longitude?: number,
  location?: { building, floor, room }
})
```

#### List Incidents
```javascript
const response = await apiClient.incidents.list({
  organizationId: string,
  userId?: string,
  status?: string,
  limit?: number,
  offset?: number
})
```

#### Update Status
```javascript
const response = await apiClient.incidents.updateStatus({
  incidentId: string,
  status: string,
  actor: { uid, role, organizationId }
})
```

#### Assign Staff
```javascript
const response = await apiClient.incidents.assign({
  incidentId: string,
  staffId: string,
  actor: { uid, role: 'admin', organizationId }
})
```

#### Accept Incident
```javascript
const response = await apiClient.incidents.accept({
  incidentId: string,
  user: { uid, organizationId, fullName }
})
```

#### Get Analytics
```javascript
const response = await apiClient.incidents.analytics(organizationId)
```

#### Get Staff Performance
```javascript
const response = await apiClient.incidents.performance(organizationId)
```

### Staff

#### List Staff
```javascript
const response = await apiClient.staff.list(organizationId)
```

#### Update Location
```javascript
const response = await apiClient.staff.updateLocation({
  staffId: string,
  building: string,
  floor: string,
  actor?: { uid, organizationId }
})
```

#### Check Availability
```javascript
const response = await apiClient.staff.checkAvailability(staffId)
```

## Response Format

All API endpoints return responses in this format:

```javascript
{
  success: boolean,
  data: any | null,
  message: string,
  error: { message, code, details } | null,
  code: number,
  timestamp: ISO string
}
```

### Success Response
```javascript
{
  success: true,
  data: { id: 'incident-123', status: 'created' },
  message: 'Incident created successfully',
  error: null,
  code: 201
}
```

### Error Response
```javascript
{
  success: false,
  data: null,
  message: 'Validation failed',
  error: {
    message: 'Title is required',
    code: 'VALIDATION_ERROR',
    details: { title: 'Title is required' }
  },
  code: 422
}
```

## Error Handling

Always check `response.success` before accessing data:

```javascript
const response = await apiClient.incidents.create(data)

if (response.success) {
  // Handle success
  console.log('Created:', response.data.id)
} else {
  // Handle error
  switch (response.error.code) {
    case 'UNAUTHORIZED':
      redirectToLogin()
      break
    case 'VALIDATION_ERROR':
      showValidationErrors(response.error.details)
      break
    case 'FORBIDDEN':
      showNotification('You do not have permission')
      break
    default:
      showError(response.error.message)
  }
}
```

## Common Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| UNAUTHORIZED | 401 | User not authenticated |
| FORBIDDEN | 403 | User lacks permission |
| VALIDATION_ERROR | 422 | Invalid input data |
| NOT_FOUND | 404 | Resource not found |
| INTERNAL_ERROR | 500 | Server error |

## Direct API Usage (Alternative)

Instead of using `apiClient`, you can also import API modules directly:

```javascript
import { IncidentAPI, StaffAPI } from '@/services/api'

// Create incident
const response = await IncidentAPI.createIncident({
  title: 'Fire',
  description: 'Building A',
  user: currentUser
})

// Get staff
const response = await StaffAPI.getStaff({
  organizationId: 'org-123'
})
```

## External System Integration

External systems (IoT, CCTV, etc.) can call the same APIs:

```javascript
// IoT fire detector
const response = await fetch('https://api.example.com/api/incidents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Fire Detected',
    description: 'Automatic detection from IoT sensor',
    emergencyType: 'Fire',
    user: {
      uid: 'iot-system',
      organizationId: 'org-123',
      fullName: 'Fire Detection System'
    },
    location: { building: 'Building A', floor: '3' }
  })
})

const data = await response.json()
console.log('Incident created:', data.data.id)
```

## File Structure

```
src/services/api/
├── response.js              # Response builder
├── incidentApi.js           # Incident endpoints
├── staffApi.js              # Staff endpoints
├── apiClient.js             # Client wrapper
├── index.js                 # Main exports
├── mockExpressBackend.js    # Backend reference
└── API_DOCUMENTATION.md     # Full documentation
```

## Architecture Benefits

✅ **Separation of Concerns** - Business logic separate from UI  
✅ **Reusability** - Use same functions across components  
✅ **Testability** - Easy to mock for unit tests  
✅ **Type Safety** - Clear request/response contracts  
✅ **Error Handling** - Standardized error format  
✅ **Activity Logging** - All operations logged  
✅ **Backend Ready** - Can migrate to real backend without UI changes  
✅ **External Integration** - External systems can use same API  

## Future Migration to Backend

When migrating to a real Node.js/Express backend:

1. Create Express endpoints with same contract
2. Replace Firebase calls with database queries
3. Update `apiClient.js` to use HTTP calls
4. **No UI changes needed!**

Example migration:

```javascript
// Before (Firebase - current)
export const apiClient = { incidents: { create: IncidentAPIModule.createIncident } }

// After (HTTP Backend - future)
export const apiClient = {
  incidents: {
    create: (data) => fetch('/api/incidents', {
      method: 'POST',
      body: JSON.stringify(data)
    }).then(r => r.json())
  }
}

// UI code remains EXACTLY the same!
```

## Documentation

- **API_DOCUMENTATION.md** - Comprehensive API reference
- **mockExpressBackend.js** - Backend implementation example
- **apiClient.js** - Client abstraction layer
- **Response codes and formats** - In response.js

## Next Steps

1. ✅ API service layer created
2. → Update React components to use `apiClient`
3. → Add HTTP client wrapper
4. → Create Express backend
5. → Migrate to real backend
6. → Maintain API compatibility

## Support

For API questions, refer to:
- `API_DOCUMENTATION.md` - Complete reference
- `src/services/api/` - Source code with JSDoc comments
- `mockExpressBackend.js` - Implementation patterns
