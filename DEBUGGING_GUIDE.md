# Emergency System Debugging & Testing Guide

This guide explains how to use the diagnostic and testing tools to troubleshoot "Missing or insufficient permissions" errors and verify system functionality.

## Quick Start

### 1. Check System Status (Fastest)

Open browser console (F12) after logging in:

```javascript
// Import and use the status dashboard
import { checkSystemStatus } from './scripts/statusDashboard.js'
window.checkEmergencyStatus = checkSystemStatus
// Then in console:
await checkEmergencyStatus()
```

**This will show:**
- ✅ Authentication status
- ✅ User profile & organizationId
- ✅ Organization details
- ✅ Count of emergencies in system
- ✅ Data quality issues (missing fields)

### 2. Run Integration Tests (Comprehensive)

```javascript
import { runTests } from './scripts/integrationTests.js'
window.runEmergencyTests = runTests
// Then in console:
await runEmergencyTests()
```

**This will:**
- Test user authentication
- Verify organization document exists
- Test emergency read permissions
- Create/update/delete test emergency (with cleanup)
- Check data consistency
- Print detailed pass/fail report

### 3. Check Query Readiness (Before Manual Tests)

```javascript
import { validateQueryReadiness } from './scripts/debugFirestoreErrors.js'
const { ready, context } = await validateQueryReadiness()
if (ready) {
  console.log('Ready to run Firestore queries:', context)
}
```

---

## Troubleshooting Workflow

### Problem: "Missing or insufficient permissions" error

**Step 1: Verify Authentication**
```javascript
await checkSystemStatus()
// Look for: Auth Status ✅ and User Document ✅
```

**Common Findings:**
- ❌ "User is not authenticated" → Need to sign in
- ❌ "organizationId: MISSING" → User doc missing field
- ❌ "Organization document does not exist" → Org doc is missing

---

**Step 2: Check Firestore Rules**
```javascript
// In Firebase Console:
// 1. Go to Firestore Database > Rules
// 2. Verify emergencies collection has this pattern:
//    match /emergencies/{emergencyId} {
//      allow read: if isSignedIn() 
//        && resource.data.organizationId exists
//        && isSameOrg(resource.data.organizationId);
//    }
```

---

**Step 3: Validate Data Consistency**

If `checkSystemStatus()` shows "Missing organizationId" warnings:

```javascript
// Import the data fix script
import {
  validateEmergencyData,
  fixMissingOrganizationIds,
  ensureEmergencyDefaults
} from './scripts/fixEmergencyOrgIds.js'

// Run report (no changes)
await validateEmergencyData()

// If issues found, run fixes:
console.log('Fixing missing organizationIds...')
await fixMissingOrganizationIds()

console.log('Ensuring all documents have status field...')
await ensureEmergencyDefaults()

// Verify fixes
console.log('Verifying fixes...')
await validateEmergencyData()
```

---

**Step 4: Run Integration Tests**
```javascript
await runEmergencyTests()
// All tests should pass ✅
```

---

## Debug Tools Reference

### Tool 1: Status Dashboard (`statusDashboard.js`)

Comprehensive single-command diagnostic:

```javascript
import { checkSystemStatus } from './scripts/statusDashboard.js'
await checkSystemStatus()
```

**Output:**
- 🔐 Authentication Status
- 👤 User Profile (with organizationId check)
- 🏢 Organization document
- 🚨 User's emergencies & organization's emergencies
- 📊 Data quality metrics

**Identifies:**
- Auth issues
- Missing organizationId fields
- Inconsistent emergency data
- Missing user/status fields

---

### Tool 2: Firestore Error Debug (`debugFirestoreErrors.js`)

Detailed error diagnosis:

```javascript
import { logFirestoreError } from './scripts/debugFirestoreErrors.js'

try {
  // Your Firestore operation
  const result = await getDocs(emergencyQuery)
} catch (error) {
  logFirestoreError(error, { userId: user.uid, orgId: organizationId })
}
```

Explains common errors:
- `permission-denied` → Lists possible causes
- `not-found` → Document doesn't exist
- `unauthenticated` → User not logged in

---

### Tool 3: Integration Tests (`integrationTests.js`)

Full system test suite:

```javascript
import { runTests } from './scripts/integrationTests.js'
await runTests()
```

**Tests:**
1. User authentication & profile
2. Organization document existence
3. Emergency read permissions (queries)
4. Emergency create/update/delete (CRUD)
5. Data consistency (all required fields present)

**Result:** Pass/fail table showing exactly what works

---

### Tool 4: Data Validation & Repair (`fixEmergencyOrgIds.js`)

Fix legacy data issues:

```javascript
import {
  validateEmergencyData,      // Scan & report issues
  fixMissingOrganizationIds, // Repair missing fields
  ensureEmergencyDefaults    // Add default status
} from './scripts/fixEmergencyOrgIds.js'

// 1. Run validation report
await validateEmergencyData()

// 2. Fix issues
await fixMissingOrganizationIds()
await ensureEmergencyDefaults()

// 3. Verify repairs
await validateEmergencyData()
```

---

## Integration with Dashboard Components

Import debug tools in your dashboard to auto-enable debugging:

```javascript
// In UserDashboard.jsx, StaffDashboard.jsx, etc.
import { installDebugTools } from '../scripts/debugFirestoreErrors.js'
import { installTestTools } from '../scripts/integrationTests.js'
import { installDebugTools as installStatusDashboard } from '../scripts/statusDashboard.js'

useEffect(() => {
  installDebugTools()
  installTestTools()
  installStatusDashboard()
}, [])

// Then in browser console, available functions:
// > await window.checkEmergencyStatus()
// > await window.runEmergencyTests()
// > await window.__debugFirestore.checkReady()
```

---

## Expected Successful Results

### After `checkSystemStatus()`:

```
✅ Authentication Status
  Auth UID: abc123...
  Email: user@example.com
  ✅ Auth session is active

👤 User Profile
  Organization ID: my-emergency-service ✅
  Role: staff
  ✅ User organizationId is set

🏢 Organization
  Name: My Emergency Service
  Type: hospital
  Members: 12
  ✅ Organization exists and is accessible

🚨 Emergencies
  User's Emergencies: 3 found
  Organization's Total: 8
  ✅ All organized emergencies have required fields

✅ Diagnostic Complete
```

### After `runEmergencyTests()`:

```
✅ User authentication
✅ User document exists
✅ User has organizationId
✅ User has role
✅ organizationId format correct
✅ Query emergencies by organizationId
✅ Emergency documents have organizationId field
✅ Emergency documents have userId field
✅ Emergency documents have status field
✅ Create emergency
✅ Read created emergency
✅ Update emergency status
✅ Prevent organizationId change
✅ Delete emergency
✅ All emergencies have required fields

Test Results Summary
Total Tests: 14
✅ Passed: 14
❌ Failed: 0
Success Rate: 100.0%

🎉 All tests passed!
```

---

## Common Issues & Solutions

### Issue: "organizationId: MISSING" in checkSystemStatus()

**Cause:** User document doesn't have organizationId field

**Solution:**
1. Open Firebase Console → Firestore → Collection "users"
2. Find your user document (by UID)
3. Click Edit → Add field:
   - Field name: `organizationId`
   - Type: String
   - Value: Your organization ID (must match organization doc ID exactly)
4. Click Update

---

### Issue: "Organization document does not exist"

**Cause:** Organization doc doesn't exist or has wrong ID

**Solution:**
1. Make sure organizationId in user doc matches an organization doc ID
2. In Firestore Console:
   - Go to Collection "organizations"
   - Verify organization document exists
   - Copy exact ID
3. Update user doc with exact ID

---

### Issue: All tests pass but still getting permission denied in dashboard

**Cause:** May be timing issue with auth state

**Solution:**
1. Add auth guard to your effect:
   ```javascript
   useEffect(() => {
     if (!user?.organizationId || !auth.currentUser) {
       return
     }
     // Now safe to do Firestore operations
   }, [user, auth.currentUser])
   ```

2. Check if organizationId contains spaces/special characters:
   ```javascript
   console.log('organizationId:', JSON.stringify(user?.organizationId))
   // Should be simple string like "my-org" not "my org" or "my-org\n"
   ```

---

### Issue: Test creates emergency but can't read it

**Cause:** Data written before Firestore rules propagated

**Solution:**
1. Small delay may help:
   ```javascript
   await new Promise(resolve => setTimeout(resolve, 500))
   ```

2. Or check if organizationId matches exactly:
   ```javascript
   const emergency = { organizationId: userData.organizationId }
   // Verify no extra spaces/case differences
   ```

---

## Advanced: Backend Validation Script

For server/admin-level data validation:

```javascript
// Run in Firebase Cloud Functions or admin console
const admin = require('firebase-admin')
const db = admin.firestore()

async function validateAllEmergencies() {
  const emergencies = await db.collection('emergencies').get()
  const issues = []

  for (const doc of emergencies.docs) {
    const data = doc.data()
    if (!data.organizationId) {
      issues.push({ doc: doc.id, issue: 'missing organizationId' })
    }
  }

  console.log(`Found ${issues.length} issues out of ${emergencies.size} documents`)
  return issues
}

validateAllEmergencies()
```

---

## Testing Checklist

- [ ] `checkSystemStatus()` shows all ✅ indicators
- [ ] `runEmergencyTests()` shows 100% pass rate
- [ ] Can create new emergency via dashboard
- [ ] Can see emergency in dashboard query results
- [ ] organizationId field present in all documents
- [ ] No "permission-denied" errors in console
- [ ] Auth guards in all dashboard effect hooks

---

## Need More Help?

If issues persist after running these diagnostics:

1. **Collect full diagnostic output:**
   ```javascript
   window.debugLog = {
     status: await checkSystemStatus(),
     tests: await runEmergencyTests(),
     errors: window.lastTestResults
   }
   console.json(window.debugLog)
   ```

2. **Check browser console for errors:** Press F12, click "Console" tab

3. **Check Firestore Rules for syntax errors:**
   - Firebase Console → Firestore Database → Rules tab
   - Look for red error underlines

4. **Verify data in Firestore directly:**
   - Firebase Console → Firestore Database
   - Check "users" collection has organizationId field
   - Check emergencies collection has organizationId field

---

Last Updated: Message 8 of conversation
Related Files: emergencyService.js, UserContext.jsx, firestore.rules
