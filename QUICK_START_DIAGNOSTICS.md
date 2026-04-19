# Quick Start: Emergency System Diagnostics

**Tl;dr**: Open browser console (F12) and run these commands in order.

---

## The 4-Minute Fix

### Step 1: Check System (30 seconds)
```javascript
await checkEmergencyStatus()
```

**Look for:**
- ✅ All green checks = System is healthy, go to Step 4
- ❌ Red checks = Follow steps 2-3 for your specific issue

---

### Step 2: Detailed Test (1 minute)
If Step 1 found issues, run detailed tests:
```javascript
await runEmergencyTests()
```

**Output shows:**
- Which specific tests passed (✅)
- Which tests failed (❌)
- Exact error messages

---

### Step 3: Fix Issues (2 minutes)
Based on Step 2 results:

**If tests show "Missing organizationId":**
```javascript
// Check what's broken
await validateEmergencyData()

// Fix it
await fixMissingOrganizationIds()

// Verify fixed
await validateEmergencyData()
```

**If tests show "Permission denied":**
- Check Firestore Rules (see Firestore Console)
- Verify user doc has organizationId field
- Run the fix commands above

**If tests show "Organization not found":**
- Open Firebase Firestore Console
- Create /organizations/[org-id] document
- Add any fields (name, type, memberCount)

---

### Step 4: Verify All Fixed (30 seconds)
```javascript
await runEmergencyTests()
// Should show: ✅ Passed: 14, ❌ Failed: 0
```

---

## Common Issues & Quick Fixes

### Issue: "organizationId: MISSING ⚠️"
**Fix:**
1. Open Firebase Console → Firestore
2. Go to "users" collection
3. Find your user (by UID from Step 1)
4. Edit → Add field:
   - Name: `organizationId`
   - Type: String
   - Value: `[your-organization-id]` (e.g., `my-emergency-service`)
5. Save, then run Step 1 again

---

### Issue: "Organization document does not exist"
**Fix:**
1. Open Firebase Console → Firestore
2. Go to "organizations" collection
3. Create new document:
   - Document ID: Use exact value from Step 1 (your organizationId)
   - Add field: `name` = "Your Organization Name"
4. Save, then run Step 1 again

---

### Issue: All tests pass but dashboard still shows error
**Fix:**
1. Hard refresh page: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
2. Wait 2 seconds
3. Run Step 1 again
4. Check dashboard for error messages (should be gone)

---

## What Each Command Does

| Command | What | Time | Use When |
|---------|------|------|----------|
| `checkEmergencyStatus()` | Full system checkup | 2-5s | System seems broken |
| `runEmergencyTests()` | Automated tests | 5-10s | Want detailed results |
| `validateEmergencyData()` | Check data issues | 5s | Fixing schema problems |
| `fixMissingOrganizationIds()` | Repair data | 10-30s | Fixing missing fields |
| `__debugFirestore.checkReady()` | Ready to query? | <1s | Before manual queries |
| `__debugFirestore.logContext()` | Auth details | 1s | Debugging auth issues |
| `__debugFirestore.logError(error)` | Explain error | <1s | Understand error message |

---

## Full Troubleshooting if 4-Minute Fix Doesn't Work

→ **Read**: [DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md)  
→ **Reference**: [DEBUG_TOOLS_REFERENCE.md](./DEBUG_TOOLS_REFERENCE.md)

---

## Emergency Test: Everything Works?

Run this to confirm all 14 tests pass:
```javascript
const results = await runEmergencyTests()
console.log(`Success: ${results.passed}/14 tests passed`)
if (results.failed === 0) console.log('🎉 All systems ready!')
```

Expected output:
```
Success: 14/14 tests passed
🎉 All systems ready!
```

---

## Advanced: For Developers

### Before Deploying anything:
```javascript
// 1. Test locally
const before = await runEmergencyTests()

// 2. Run your changes
// ... your code changes here ...

// 3. Verify your changes didn't break tests
const after = await runEmergencyTests()
if (before.passed === after.passed) {
  console.log('✅ Safe to deploy')
} else {
  console.log('❌ Tests broken by changes')
}
```

### Adding to component:
```javascript
import Auth from 'firebase/auth'

export function MyDashboard() {
  useEffect(async () => {
    // Auto-run diagnostics on component mount
    const ready = await window.__debugFirestore.checkReady()
    if (!ready.ready) {
      console.error('Cannot fetch data:', ready.reason)
      return
    }
    // Safe to do Firestore operations now
  }, [])
  
  return <div>Dashboard content...</div>
}
```

---

## Keyboard Shortcuts

**In Browser Console:**
- **F12** (Ctrl+Shift+I on Linux) = Open developer tools
- **Ctrl+L** = Clear console
- **Arrow Up** = Previous command
- **Tab** = Autocomplete

**Copy full results:**
```javascript
const results = await checkEmergencyStatus()
copy(results)  // Paste in email/ticket
```

---

## When to Call Support

If `runEmergencyTests()` shows:
- ✅ 14/14 passed = System works, UI may need debugging
- ❌ <14 passed = System has issues, follow Step 3 above
- ❌ Tools won't load = Firebase SDK issue
- ❌ Network error = Check internet connection

For Step 3 failures, provide:
```javascript
// Get everything for support ticket
{
  status: await checkEmergencyStatus(),
  tests: await runEmergencyTests(),
  browser: navigator.userAgent
}
```

---

## Tips for Power Users

### Monitor in Real-Time
```javascript
// Auto-check every 10 seconds
setInterval(async () => {
  const status = await checkEmergencyStatus()
  if (status includes ❌) alert('System issue detected!')
}, 10000)
```

### Create Admin Panel
```javascript
// In your admin dashboard:
<button onClick={async () => {
  const results = await runEmergencyTests()
  return <pre>{JSON.stringify(results, null, 2)}</pre>
}}>
  System Check
</button>
```

### Automate Data Fixes
```javascript
// Run nightly to keep data clean:
async function maintenanceCron() {
  await validateEmergencyData()
  await fixMissingOrganizationIds()
  await ensureEmergencyDefaults()
  await validateEmergencyData()
}
```

---

## Still Need Help?

1. **Read the guide**: [DEBUGGING_GUIDE.md](./DEBUGGING_GUIDE.md)
2. **Check your issue**: Use quick fixes table above
3. **Run the tests**: `await runEmergencyTests()`
4. **Share results** with your team or support

---

## One-Liner Breakdown

```javascript
// Health check (1s)
await checkEmergencyStatus()

// If unhealthy, detailed tests (5-10s)
await runEmergencyTests()

// If tests show data issues, fix it (10-30s)
await fixMissingOrganizationIds()

// If tests show permission issues, check rules in Firestore Console

// Verify fixed (5-10s)
await runEmergencyTests()

// All pass? ✅ You're done!
```

---

**Last Updated**: Session 8+  
**Status**: Ready for immediate use  
**Tools Available**: Automatically loaded in browser console
