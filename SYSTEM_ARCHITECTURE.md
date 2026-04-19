# 🏗️ System Architecture & Data Flow

## System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    RESQNET EMERGENCY SYSTEM                     │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
    │  User Role   │      │  Staff Role  │      │  Admin Role  │
    │  Dashboard   │      │  Dashboard   │      │  Dashboard   │
    └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
           │                     │                     │
           │ Real-time           │ Real-time          │ Real-time
           │ Listener            │ Listener           │ Listener
           │                     │                    │
           ▼                     ▼                    ▼
    ┌──────────────────────────────────────────────────────────┐
    │          Firebase Authentication (Auth)                 │
    │  - Email/Password Login                                 │
    │  - User Session Management                              │
    └──────────────────────────────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────────────────────────┐
    │              UserContext.jsx (React)                     │
    │  - Loads user data with organizationId                  │
    │  - Provides user to all components                      │
    └──────────────────────────────────────────────────────────┘
           │
           ▼
    ┌──────────────────────────────────────────────────────────┐
    │            Firestore Real-Time Queries                  │
    │  - Filtered by organizationId                           │
    │  - Ordered by createdAt                                 │
    │  - onSnapshot listeners                                 │
    └──────────────────────────────────────────────────────────┘
           │
           ├─────────────────────────────────────────┐
           │                                         │
           ▼                                         ▼
    ┌──────────────────┐              ┌──────────────────┐
    │  Emergency Docs  │              │ Organization     │
    │  in Firestore    │              │ Boundaries       │
    │                  │              │                  │
    │ ✓ userId        │              │ ✓ Org A only     │
    │ ✓ organizationId │              │   sees Org A     │
    │ ✓ status        │              │                  │
    │ ✓ createdAt     │              │ ✓ Org B only     │
    │                  │              │   sees Org B     │
    └──────────────────┘              │                  │
                                      └──────────────────┘
```

---

## Query Flow for Each Dashboard

### Admin Dashboard Query
```
┌─────────────────────────────────────┐
│ Admin accesses Admin Dashboard      │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ Check: user.organizationId exists?                      │
│ ✓ YES → Setup query                                    │
│ ✗ NO  → Wait for user context to load                  │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ Firestore Query:                                        │
│                                                         │
│ query(                                                  │
│   collection(db, 'emergencies'),                       │
│   where('organizationId', '==', 'org_ABC123'),  ◄──┐   │
│   orderBy('createdAt', 'desc')                  │   │
│ )                                               │   │
│                                                 │   │
│ Result: ALL emergencies in Org ABC             ◄───┤
│         Sorted by newest first                 │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Real-time Listener  │
                    │ onSnapshot          │
                    └────────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                        │
                    ▼                        ▼
            ┌──────────────┐        ┌───────────────┐
            │ Success:     │        │ Error:        │
            │ Display      │        │ Show error    │
            │ emergencies  │        │ message       │
            │ in dashboard │        │ & log details │
            └──────────────┘        └───────────────┘
```

### User Dashboard Query
```
┌─────────────────────────────────────┐
│ User accesses User Dashboard        │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ Check: user.organizationId exists?                      │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│ Firestore Query:                                        │
│                                                         │
│ query(                                                  │
│   collection(db, 'emergencies'),                       │
│   where('userId', '==', 'user_XYZ'),            ◄──┐   │
│   where('organizationId', '==', 'org_ABC123'),  │   │
│   orderBy('createdAt', 'desc')                  │   │
│ )                                               │   │
│                                          ◄──────┤   │
│ Result: ONLY user's emergencies        │           │
│         in their organization          │           │
│         Sorted by newest first         │           │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────┐
        │ Matched Emergencies       │
        │ (Empty or list)           │
        └───────────────────────────┘
```

---

## Data Creation & Validation Flow

### Emergency Creation in User Dashboard
```
┌─────────────────────────────────────┐
│ User clicks "Report Emergency"       │
└────────────┬────────────────────────┘
             │
             ▼
    ╔═════════════════════════════╗
    ║   CLIENT-SIDE VALIDATION   ║
    ╚══════════┬══════════════════╝
             │
             ├─ Is user logged in?
             ├─ Is organizationId set?  ◄──── NEW VALIDATION
             ├─ Is description entered?  ◄──── NEW VALIDATION
             ├─ Geolocation allowed?
             └─ User data fetched?
             │
             ▼
    ┌──────────────────────────────┐
    │ Collect Emergency Data:      │
    │ {                            │
    │   userId: auth.uid,     ────┐│
    │   userName: user.name,  ──┐ ││
    │   phone: user.phone,   ──┼─││
    │   emergencyType,       │  ││
    │   description,         │  ││
    │   latitude,            │  ││
    │   longitude,           │  ││
    │   status: 'pending',   │  ││
    │   assignedTo: null,    │  ││
    │   organizationId,  ◄───┴──┼┤  NEW: Always add from context
    │   createdAt            │  ││
    │ }                      │  ││
    │                        │  ││
    │ From Firestore ────────┘  ││
    │ From user context ─────────┘│
    └──────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Send to Firestore            │
    │ addDoc(collection, data)     │
    └──────────────────┬───────────┘
                       │
                       ▼
    ╔═════════════════════════════╗
    ║   FIRESTORE RULES CHECK    ║
    ╚══════════┬══════════════════╝
             │
             ├─ isSignedIn()?
             ├─ userId matches auth?
             ├─ organizationId matches user's org?
             ├─ status is string?
             ├─ createdAt is timestamp?
             └─ All checks pass?
             │
             ▼
    ┌──────────────────────────────┐
    │ ✓ Emergency Saved to DB      │
    │   with organizationId field  │
    └──────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Real-time Listeners Notified │
    │ (All dashboards in Org ABC)  │
    │                              │
    │ ► User Dashboard updated     │
    │ ► Staff Dashboard updated    │
    │ ► Admin Dashboard updated    │
    └──────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ ✗ Other Organizations        │
    │   Do NOT see update          │
    │   (Org XYZ, Org DEF, etc)    │
    └──────────────────────────────┘
```

---

## Organization Boundary Enforcement

```
┌─────────────────────────────────────────────────────────┐
│              ORGANIZATION DATA ISOLATION               │
└─────────────────────────────────────────────────────────┘

        ┌────────────────────────────────────────────┐
        │         Firestore Database                 │
        └────────────────────────────────────────────┘
         │        │        │        │        │
         │        │        │        │        │
    ┌────▼──┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───┐
    │ Org A │ │ Org B│ │ Org C│ │ Org D│ │ Org E│
    │ Data  │ │ Data │ │ Data │ │ Data │ │ Data │
    └────┬──┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
         │       │        │        │        │
    ┌────────────────────────────────────────────┐
    │                                            │
    │  Firestore Rules Filter Layer         ◄──┤
    │                                            │
    │  where('organizationId', '==',             │
    │         user.organizationId)               │
    │                                            │
    └────────────────────────────────────────────┘
         │       │        │        │        │
         │       │        │        │        │
    ┌────▼──┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───┐
    │ User  │ │Staff │ │Admin │ │User  │ │Staff │
    │ in Org│ │in Org│ │in Org│ │in Org│ │in Org│
    │  A    │ │  A   │ │  A   │ │  B   │ │  B   │
    ├───────┤ ├──────┤ ├──────┤ ├──────┤ ├──────┤
    │Sees A │ │Sees A│ │Sees A│ │Sees B│ │Sees B│
    │only   │ │only  │ │only  │ │only  │ │only  │
    └───────┘ └──────┘ └──────┘ └──────┘ └──────┘
```

---

## Firestore Index Requirements

```
┌──────────────────────────────────────────────────┐
│         FIRESTORE COMPOSITE INDEXES              │
└──────────────────────────────────────────────────┘

INDEX 1: Admin/Staff Emergency List
┌────────────────────────────────────┐
│ Collection: emergencies            │
│ Sort Fields:                       │
│   1. organizationId (ASC)         │  ◄─ Filter first
│   2. createdAt (DESC)             │  ◄─ Then sort
│                                   │
│ Query Type:                        │
│   query(                          │
│     collection(...),              │
│     where('organizationId', ...),  │
│     orderBy('createdAt', 'desc')  │
│   )                               │
└────────────────────────────────────┘

INDEX 2: User's Personal Emergencies
┌────────────────────────────────────┐
│ Collection: emergencies            │
│ Sort Fields:                       │
│   1. userId (ASC)                 │  ◄─ Filter by user
│   2. organizationId (ASC)         │  ◄─ Filter by org
│   3. createdAt (DESC)             │  ◄─ Then sort
│                                   │
│ Query Type:                        │
│   query(                          │
│     collection(...),              │
│     where('userId', ...),         │
│     where('organizationId', ...),  │
│     orderBy('createdAt', 'desc')  │
│   )                               │
└────────────────────────────────────┘

WITHOUT INDEXES:
   ❌ "The query requires an index"
   ❌ Queries fail or return error

WITH INDEXES:
   ✓ Query executes in <100ms
   ✓ Data automatically sorted
   ✓ Only org data returned
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────┐
│            ENHANCED ERROR HANDLING                  │
└─────────────────────────────────────────────────────┘

Event: Dashboard initialization
       │
       ├─ organizationId null?
       │  └─ LOG to console
       │  └─ setError('Organization not set...')
       │  └─ Return early (don't query)
       │
       ├─ Query setup exception?
       │  └─ LOG: "Query setup error"
       │  └─ CATCH exception
       │  └─ setError with details
       │
       ├─ Firestore listener error?
       │  └─ LOG: "Firestore listener error"
       │  └─ Error callback fires
       │  └─ setError with error.message
       │
       └─ Success (data received)
          └─ LOG: snapshot details
          └─ Display to user
          └─ Setup real-time updates

RESULT:
  ✓ Errors caught at each level
  ✓ Helpful messages to user
  ✓ Console logs for debugging
  ✓ No silent failures
```

---

## Real-Time Update Flow

```
┌─────────────────────────────────────────────────────┐
│     REAL-TIME EMERGENCY UPDATES                     │
└─────────────────────────────────────────────────────┘

User A creates emergency in Org A
        │
        ▼
Emergency saved to Firestore
        │
        ├─ Assigned organizationId: 'org_ABC123'
        ├─ Assigned userId: 'user_123'
        ├─ Assigned status: 'pending'
        │
        ▼
Firestore triggers updates
        │
        ├──────────────────────────────────────┐
        │                                      │
        ▼                                      ▼
User Dashboard listener       Admin Dashboard listener
(User A in Org A)            (Admin in Org A)
        │                              │
        ├─ organizationId              ├─ organizationId
        │   matches?                   │   matches?
        │   ✓ YES                      │   ✓ YES
        │                              │
        ▼                              ▼
Update emergency list        Update emergency list
        │                              │
        ┌─ New emergency              ┌─ New emergency
        │   appears                   │   appears
        │ ✓ Instantly                 │ ✓ Instantly
        │                              │
    [Org A User]                  [Org A Admin]
        │                              │
        └─────────────┬────────────────┘
                      │
              ┌───────┴────────┐
              │                │
              ▼                ▼
         [Org B User]      Staff Dashboard
         (in Org B)        (in Org B)
              │                │
              ├─ NO update     ├─ NO update
              ├─ organizationId├─ organizationId
              │   != match     │   != match
              │ ✓ Isolated     │ ✓ Isolated
              │                │
```

---

## Data Structure Schema

```
Collections in Firestore:

📁 users/
   ├─ uid: string (doc ID)
   ├─ fullName: string
   ├─ email: string
   ├─ phone: string
   ├─ role: 'user' | 'staff' | 'admin'
   ├─ organizationId: string ◄──── CRITICAL
   └─ createdAt: timestamp

📁 organizations/
   ├─ orgId: string (doc ID)
   ├─ name: string
   ├─ type: 'hotel' | 'school' | 'hospital' | etc
   ├─ location: string
   ├─ contact: string
   ├─ description: string
   ├─ createdBy: string (user ID)
   └─ createdAt: timestamp

📁 emergencies/ ◄──────── INDEXED
   ├─ emergencyId: string (doc ID)
   ├─ userId: string ◄──────── INDEX 2
   ├─ organizationId: string ◄─ INDEX 1 & 2 (CRITICAL)
   ├─ userName: string
   ├─ phone: string
   ├─ emergencyType: string
   ├─ description: string
   ├─ latitude: number
   ├─ longitude: number
   ├─ status: 'pending' | 'accepted' | 'in progress' | 'resolved'
   ├─ assignedTo: string | null
   ├─ createdAt: timestamp ◄─ INDEX 1 & 2 (For sorting)
   └─ updatedAt: timestamp
```

---

Generated: 2026-04-15  
Version: 1.0 - System Architecture & Data Flow
