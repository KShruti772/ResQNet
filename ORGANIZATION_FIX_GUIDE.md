# Organization-Based Data Visibility Fix Guide

## 🎯 Overview
This guide documents all fixes implemented to ensure emergencies are correctly filtered by organization across all dashboards.

---

## ✅ Fixes Implemented

### 1. **AdminDashboard.jsx** - Fixed Emergency Query & Creation

#### Query Fix (Lines 51-87):
```javascript
// ✅ BEFORE: Missing orderBy, poor error handling
const q = query(collection(db, 'emergencies'), where('organizationId', '==', user.organizationId))

// ✅ AFTER: Added orderBy for consistency, enhanced error logging
const q = query(
    collection(db, 'emergencies'),
    where('organizationId', '==', user.organizationId),
    orderBy('createdAt', 'desc')
)
```

**Changes:**
- Added `orderBy('createdAt', 'desc')` for consistent sorting
- Added comprehensive console logging for debugging
- Enhanced error handling with detailed error messages
- Added check to validate `organizationId` exists before query

#### Demo Emergency Creation Fix (Lines 89-123):
```javascript
// ✅ Added validation for organizationId
if (!user?.organizationId) {
    setError('Organization ID is not set. Please set up your organization first.')
    return
}

// ✅ Use auth.currentUser.uid instead of hardcoded 'demo-user'
userId: auth.currentUser.uid,

// ✅ Added detailed logging
console.log('Creating demo emergency:', {
    userId: emergencyData.userId,
    organizationId: emergencyData.organizationId,
    type: emergencyData.emergencyType
})
```

**Changes:**
- Validate `organizationId` before creating emergency
- Use authenticated user ID instead of 'demo-user'
- Added comprehensive error logging
- Better error messages to user

---

### 2. **StaffDashboard.jsx** - Fixed Emergency Query

#### Query Fix (Lines 26-62):
```javascript
// ✅ Added orderBy and enhanced error handling
const q = query(
    collection(db, 'emergencies'),
    where('organizationId', '==', user.organizationId),
    orderBy('createdAt', 'desc')
)
```

**Changes:**
- Added `orderBy('createdAt', 'desc')` for consistent sorting
- Enhanced error logging and validation
- Better error messages for troubleshooting
- Added validation to wait for `organizationId` to load

---

### 3. **UserDashboard.jsx** - Fixed Emergency Query & Creation

#### Query Fix (Lines 28-64):
```javascript
// ✅ Added error handling and logging
const q = query(
    collection(db, 'emergencies'),
    where('userId', '==', user.uid),
    where('organizationId', '==', user.organizationId),
    orderBy('createdAt', 'desc')
)
```

**Changes:**
- Added error handling callback
- Enhanced logging for debugging
- Proper waiting for `organizationId` to load

#### Emergency Creation Fix (handleEmergency) (Lines 107-177):
```javascript
// ✅ Added validation checks
if (!user.organizationId) {
    setError('Organization not set. Please complete organization setup first.')
    return
}

if (!description.trim()) {
    setError('Please provide an emergency description.')
    return
}

// ✅ Enhanced error reporting
console.log('Creating emergency with data:', {
    userId: emergencyData.userId,
    organizationId: emergencyData.organizationId,
    type: emergencyData.emergencyType,
    coords: { latitude, longitude }
})

// ✅ Better error messages and recovery
setDescription('')
setEmergencyType('General')
```

**Changes:**
- Validate `organizationId` exists
- Validate description is not empty
- Better logging for debugging
- Reset form after successful submission
- Detailed error messages to user

---

## 🗂️ Data Structure Requirements

Each emergency document **MUST** include these fields:

```javascript
{
    userId: string,              // ✅ User who created emergency
    organizationId: string,      // ✅ CRITICAL: Organization filter
    status: string,              // ✅ 'pending', 'accepted', 'in progress', 'resolved'
    createdAt: timestamp,        // ✅ For sorting
    emergencyType: string,       // Additional: 'Fire', 'Medical', 'Security', 'General'
    description: string,         // Additional: Emergency description
    latitude: number,            // Additional: Location
    longitude: number,           // Additional: Location
    userName: string,            // Additional: Reporter name
    phone: string,               // Additional: Contact number
    assignedTo: string | null,   // Additional: Assigned staff ID
}
```

---

## 🔒 Firestore Security Rules (Verified ✅)

The security rules in `firestore.rules` are correct:

```firestore
match /emergencies/{emergencyId} {
  // ✅ Only allow reading emergencies from your organization
  allow read: if isSignedIn() && isSameOrg(resource.data.organizationId);
  
  // ✅ Only allow creating with proper organizationId
  allow create: if isSignedIn()
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.organizationId == userOrgId()
    && request.resource.data.status is string
    && request.resource.data.createdAt is timestamp;
    
  // ✅ Only allow updating within same organization
  allow update, delete: if isSignedIn()
    && isSameOrg(resource.data.organizationId)
    && request.resource.data.organizationId == resource.data.organizationId;
}
```

---

## 📑 Firestore Index Requirements

To enable the multi-field queries, create these composite indexes in Firestore:

### Index 1: Admin/Staff Emergency List
- **Collection:** `emergencies`
- **Fields:**
  - `organizationId` (Ascending)
  - `createdAt` (Descending)
- **Status:** Required for Admin/Staff dashboards

### Index 2: User's Personal Emergencies
- **Collection:** `emergencies`
- **Fields:**
  - `userId` (Ascending)
  - `organizationId` (Ascending)
  - `createdAt` (Descending)
- **Status:** Required for User dashboard

**How to Create Indexes:**
1. Go to Firebase Console → Firestore Database
2. Click "Indexes" tab
3. Under "Composite Indexes", click "Create Index"
4. Add the fields and set sort order as specified above

Firebase will prompt you to create these when you first run the queries if they don't exist.

---

## 🔄 Query Flow - How It Works Now

### Admin Dashboard
1. ✅ Load user from context (includes `organizationId`)
2. ✅ Query: `where organizationId == user.organizationId` + `orderBy createdAt desc`
3. ✅ Real-time listener returns only org emergencies
4. ✅ Demo emergency created with `organizationId` and authenticated user ID

### Staff Dashboard
1. ✅ Load user from context (includes `organizationId`)
2. ✅ Query: `where organizationId == user.organizationId` + `orderBy createdAt desc`
3. ✅ Real-time listener returns only org emergencies
4. ✅ Staff can filter by their assigned cases

### User Dashboard
1. ✅ Load user from context (includes `organizationId`)
2. ✅ Query: `where userId == user.uid AND organizationId == user.organizationId` + `orderBy createdAt desc`
3. ✅ Real-time listener returns only user's emergencies within org
4. ✅ New emergencies get `organizationId` from context

---

## 🐛 Debugging Guide

### If emergencies still don't appear:

#### Step 1: Check Organization Setup
```javascript
// Open browser console and run:
console.log(user)
// Should show: { uid, role, organizationId, organizationName }
// If organizationId is null, complete organization setup first
```

#### Step 2: Check Firestore Rules
1. Go to Firebase Console → Firestore → Rules
2. Verify rules match the code in `firestore.rules`
3. Publish rules if modified

#### Step 3: Check Composite Indexes
1. Go to Firebase Console → Firestore → Indexes
2. Verify the two indexes exist and are "Enabled"
3. If missing, create them as specified in "Firestore Index Requirements" section

#### Step 4: Check Browser Console for Errors
1. Open DevTools → Console tab
2. Look for `AdminDashboard: Setting up query...` messages
3. Look for any Firestore permission errors
4. Check for query structure errors

#### Step 5: Verify Emergency Data
1. Go to Firebase Console → Firestore → emergencies collection
2. Check if new emergencies have `organizationId` field
3. Verify `organizationId` matches the current user's organization
4. Check `createdAt` is a timestamp (not string)

---

## ✨ Testing Checklist

- [ ] Register a new user
- [ ] Create a new organization (or join existing)
- [ ] Verify `organizationId` appears in user document
- [ ] Create demo emergency from Admin dashboard
- [ ] Verify emergency appears in Admin, Staff, and User dashboards
- [ ] Create real emergency from User dashboard
- [ ] Verify it filters correctly in all dashboards
- [ ] Test with multiple organizations
- [ ] Verify users from different orgs can't see each other's emergencies
- [ ] Check console logs for debugging messages

---

## 📊 Summary of Changes

| Component | Issue | Fix |
|-----------|-------|-----|
| AdminDashboard | Missing orderBy, poor error logging | Added orderBy, console logging, validation |
| AdminDashboard | Demo emergency using hardcoded user ID | Use auth.currentUser.uid |
| StaffDashboard | Missing orderBy, poor error logging | Added orderBy, console logging, validation |
| UserDashboard | Missing error callbacks on query | Added error handlers and logging |
| UserDashboard | Missing validation on creation | Added organizationId and description checks |
| All Dashboards | Missing organizationId validation | Added checks before queries |
| All Dashboards | Vague error messages | Added detailed error reporting |

---

## 🚀 Deployment Notes

1. **Before deploying to production:**
   - Verify all three Firestore indexes are enabled
   - Test with multiple organizations
   - Clear browser cache and Hard Refresh (Ctrl+Shift+R)

2. **Firebase Console Setup:**
   - Update Firestore rules from `firestore.rules` file
   - Create composite indexes as specified
   - Verify security rules are deployed

3. **Client-side debugging:**
   - Check browser console for the new logging messages
   - Look for organization ID in user context
   - Verify emergencies have correct organizationId in Firestore

---

## 📞 Common Issues & Solutions

### Issue: "Unable to load emergency alerts"
**Solution:** Check browser console for detailed error. Usually a missing Firestore index.

### Issue: Emergencies appear but are mixed across organizations
**Solution:** Verify all users have correct `organizationId` in users collection.

### Issue: Demo emergency not appearing
**Solution:** Check that `organizationId` is set before creating demo emergency.

### Issue: "Organization ID is not set"
**Solution:** Complete organization setup in Organization Setup page first.

---

Generated: 2026-04-15
Version: 1.0 - Organization Data Visibility Fix
