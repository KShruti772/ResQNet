// ============================================================================
// Firestore Index Setup Helper
// ============================================================================
// Copy-paste these index configurations into Firebase Console
// Path: Firestore Database > Indexes > Composite Indexes > Create Index

// ============================================================================
// INDEX 1: Organization Emergency List (Admin/Staff Dashboard)
// ============================================================================
// Collection: emergencies
// Fields to add:
// - organizationId (Ascending)
// - createdAt (Descending)
// Query name: Query for emergency list filtered by organization

// ============================================================================
// INDEX 2: User's Personal Emergencies (User Dashboard)
// ============================================================================
// Collection: emergencies
// Fields to add:
// - userId (Ascending)
// - organizationId (Ascending)
// - createdAt (Descending)
// Query name: Query for user's emergencies within organization

// ============================================================================
// Why These Indexes?
// ============================================================================
// 
// Firestore requires composite indexes when querying multiple fields
// with orderBy. Without these indexes, queries will fail with:
// "The query requires an index" error
//
// Index 1 supports:
//   - Admin & Staff viewing all organization emergencies
//   - Filtered by organizationId, sorted by creation time
//
// Index 2 supports:
//   - User viewing their personal emergencies
//   - Filtered by userId AND organizationId, sorted by time
//

// ============================================================================
// Firestore Rules Validation
// ============================================================================
// 
// ✅ Users can only READ emergencies from their organization
// ✅ Users can only CREATE emergencies with their own userId
// ✅ organizationId must match their organization
// ✅ Users cannot UPDATE or DELETE emergencies from other orgs
//
// See firestore.rules for complete security configuration
//

export const FIRESTORE_INDEXES = {
    emergencies_org_time: {
        collection: 'emergencies',
        fields: [
            { fieldPath: 'organizationId', order: 'ASCENDING' },
            { fieldPath: 'createdAt', order: 'DESCENDING' }
        ],
        queryScope: 'COLLECTION'
    },
    emergencies_user_org_time: {
        collection: 'emergencies',
        fields: [
            { fieldPath: 'userId', order: 'ASCENDING' },
            { fieldPath: 'organizationId', order: 'ASCENDING' },
            { fieldPath: 'createdAt', order: 'DESCENDING' }
        ],
        queryScope: 'COLLECTION'
    }
}

// Manual Setup Steps:
// 1. Go to Firebase Console (https://console.firebase.google.com)
// 2. Select your project (resqnet-ba073)
// 3. Navigate to Firestore Database
// 4. Click "Indexes" tab (left sidebar)
// 5. Under "Composite Indexes", click "Create Index"
// 6. Enter collection name: "emergencies"
// 7. Add fields in order shown above
// 8. Set sort order: ASCENDING for organizationId/userId, DESCENDING for createdAt
// 9. Click "Create"
// 10. Repeat for second index
// 11. Wait for indexes to be "Enabled" (usually 2-10 minutes)

// If Firestore prompts you about missing indexes during development,
// click the link in the error message to auto-create the indexes.
