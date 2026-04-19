/**
 * Emergency System Status Dashboard
 * 
 * Comprehensive diagnostic tool for checking:
 * - User authentication & organization status
 * - Firestore data consistency
 * - Permission enforcement
 * - Emergency query results
 * 
 * Usage: Import and call checkSystemStatus() after login
 */

import { auth, db } from '../src/firebase.js'
import { doc, getDoc, query, collection, where, getDocs, collectionGroup } from 'firebase/firestore'

export const checkSystemStatus = async () => {
    console.clear()
    console.log(
        '%c🚨 Emergency System Status Dashboard',
        'font-size: 18px; font-weight: bold; color: #1f2937;'
    )
    console.log('%c' + '='.repeat(60), 'color: #9ca3af;')

    const startTime = performance.now()

    try {
        // 1. Authentication Status
        await checkAuthStatus()

        // 2. User Profile & Organization
        const userData = await checkUserProfile()

        if (userData.uid && userData.organizationId) {
            // 3. Organization Validation
            await checkOrganization(userData.organizationId)

            // 4. User's Emergencies
            await checkEmergencies(userData.uid, userData.organizationId)

            // 5. Data Consistency Checks
            await checkDataConsistency(userData.organizationId)
        }

        // 6. Performance Summary
        const elapsed = (performance.now() - startTime).toFixed(2)
        console.log(
            `\n%c✅ Diagnostic Complete (${elapsed}ms)`,
            'color: #10b981; font-weight: bold;'
        )
    } catch (error) {
        console.error('❌ Diagnostic failed:', error.message)
    }

    console.log('%c' + '='.repeat(60), 'color: #9ca3af;')
}

async function checkAuthStatus() {
    console.group('%c🔐 Authentication Status', 'color: #3b82f6; font-weight: bold;')

    const user = auth.currentUser

    if (!user) {
        console.error('❌ NO ACTIVE AUTH SESSION')
        throw new Error('User is not authenticated. Please sign in first.')
    }

    console.table({
        'Auth UID': user.uid,
        'Email': user.email,
        'Auth Provider': user.providerData[0]?.providerId || 'unknown',
        'Email Verified': user.emailVerified,
        'Created': new Date(user.metadata.creationTime).toLocaleString(),
        'Last Sign In': new Date(user.metadata.lastSignInTime).toLocaleString()
    })

    console.log('✅ Auth session is active')
    console.groupEnd()
}

async function checkUserProfile() {
    console.group('%c👤 User Profile', 'color: #8b5cf6; font-weight: bold;')

    const uid = auth.currentUser.uid
    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
        console.error(`❌ User document does not exist at /users/${uid}`)
        console.groupEnd()
        throw new Error('User document missing')
    }

    const userData = userSnap.data()

    console.table({
        'UID': uid,
        'Full Name': userData.fullName || 'N/A',
        'Email': userData.email || 'N/A',
        'Organization ID': userData.organizationId || '❌ MISSING',
        'Organization Name': userData.organizationName || 'N/A',
        'Role': userData.role || 'N/A',
        'Status': userData.status || 'N/A'
    })

    // Validation
    if (!userData.organizationId) {
        console.error('❌ CRITICAL: User document is missing organizationId field')
        console.error('   This will prevent all Firestore queries from working!')
    } else {
        console.log('✅ User organizationId is set:', userData.organizationId)
    }

    console.groupEnd()

    return {
        uid,
        fullName: userData.fullName,
        organizationId: userData.organizationId,
        organizationName: userData.organizationName,
        role: userData.role
    }
}

async function checkOrganization(orgId) {
    console.group('%c🏢 Organization', 'color: #06b6d4; font-weight: bold;')

    const orgRef = doc(db, 'organizations', orgId)
    const orgSnap = await getDoc(orgRef)

    if (!orgSnap.exists()) {
        console.error(`❌ Organization document does not exist: ${orgId}`)
        console.groupEnd()
        return
    }

    const orgData = orgSnap.data()

    console.table({
        'Organization ID': orgId,
        'Name': orgData.name || 'N/A',
        'Type': orgData.type || 'N/A',
        'Status': orgData.status || 'N/A',
        'Members': orgData.memberCount || 'N/A',
        'Created': orgSnap.metadata?.timeCreated
            ? new Date(orgSnap.metadata.timeCreated).toLocaleString()
            : 'N/A'
    })

    console.log('✅ Organization exists and is accessible')
    console.groupEnd()
}

async function checkEmergencies(userId, orgId) {
    console.group('%c🚨 Emergencies', 'color: #ef4444; font-weight: bold;')

    try {
        // Query user's emergencies
        const userEmergenciesQuery = query(
            collection(db, 'emergencies'),
            where('organizationId', '==', orgId),
            where('userId', '==', userId)
        )

        const userEmergenciesSnap = await getDocs(userEmergenciesQuery)
        console.log(`User's Emergencies: ${userEmergenciesSnap.size} found`)

        if (userEmergenciesSnap.size === 0) {
            console.warn('No emergencies created by this user yet')
        } else {
            userEmergenciesSnap.forEach((doc, index) => {
                const data = doc.data()
                console.log(`  [${index + 1}] ${doc.id}`, {
                    type: data.emergencyType,
                    status: data.status,
                    created: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString() : 'N/A',
                    orgId: data.organizationId
                })
            })
        }

        // Query organization's emergencies
        const orgEmergenciesQuery = query(
            collection(db, 'emergencies'),
            where('organizationId', '==', orgId)
        )

        const orgEmergenciesSnap = await getDocs(orgEmergenciesQuery)
        console.log(`Organization's Total Emergencies: ${orgEmergenciesSnap.size}`)

        // Data quality check
        let missingOrgId = 0
        let missingUserId = 0
        let missingStatus = 0

        orgEmergenciesSnap.forEach((doc) => {
            const data = doc.data()
            if (!data.organizationId) missingOrgId++
            if (!data.userId) missingUserId++
            if (!data.status) missingStatus++
        })

        console.log('Data Quality:', {
            'Missing organizationId': missingOrgId,
            'Missing userId': missingUserId,
            'Missing status': missingStatus,
            'Total Documents': orgEmergenciesSnap.size
        })

        if (missingOrgId + missingUserId + missingStatus > 0) {
            console.warn('⚠️ Some documents have missing fields. Run fixEmergencyOrgIds.js')
        } else {
            console.log('✅ All organized emergencies have required fields')
        }

        console.groupEnd()
    } catch (error) {
        console.error('❌ Error querying emergencies:', error.message)
        if (error.code === 'permission-denied') {
            console.error('    Permission denied - check firestore.rules')
        }
        console.groupEnd()
    }
}

async function checkDataConsistency(orgId) {
    console.group('%c📊 Data Consistency Check', 'color: #f59e0b; font-weight: bold;')

    try {
        // Get all emergencies in organization
        const emergenciesQuery = query(
            collection(db, 'emergencies'),
            where('organizationId', '==', orgId)
        )

        const emergenciesSnap = await getDocs(emergenciesQuery)
        const emergencies = emergenciesSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }))

        console.log(`Checking ${emergencies.length} emergencies...`)

        // Check for inconsistencies
        const issues = {
            missingOrganizationId: [],
            wrongOrganizationId: [],
            missingUserId: [],
            missingStatus: [],
            orphanedUserReferences: []
        }

        for (const emergency of emergencies) {
            if (!emergency.organizationId) {
                issues.missingOrganizationId.push(emergency.id)
            } else if (emergency.organizationId !== orgId) {
                issues.wrongOrganizationId.push({ id: emergency.id, has: emergency.organizationId })
            }

            if (!emergency.userId) {
                issues.missingUserId.push(emergency.id)
            } else {
                // Verify user exists
                try {
                    const userRef = doc(db, 'users', emergency.userId)
                    const userSnap = await getDoc(userRef)
                    if (!userSnap.exists()) {
                        issues.orphanedUserReferences.push({ emergency: emergency.id, userId: emergency.userId })
                    }
                } catch (e) {
                    // Skip verification on permission error
                }
            }

            if (!emergency.status) {
                issues.missingStatus.push(emergency.id)
            }
        }

        // Report
        if (Object.values(issues).every((arr) => arr.length === 0)) {
            console.log('✅ All emergencies have consistent data')
        } else {
            console.warn('⚠️ Data consistency issues found:')
            console.table(issues)
        }

        console.groupEnd()
    } catch (error) {
        console.error('❌ Error checking consistency:', error.message)
        console.groupEnd()
    }
}

// Export for use in dashboards
export const installDebugTools = () => {
    if (typeof window !== 'undefined') {
        window.checkEmergencyStatus = checkSystemStatus
        console.log('💡 Debug tool installed: call checkEmergencyStatus() in console')
    }
}
