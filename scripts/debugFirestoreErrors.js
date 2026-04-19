/**
 * Debug Logger for Firestore Permission Issues
 * 
 * Purpose: Provide detailed logging for diagnosing "Missing or insufficient permissions" errors
 * 
 * Usage: Import and call logFirestorecontext() in your dashboards or before Firestore operations
 */

import { auth, db } from '../src/firebase.js'
import { doc, getDoc } from 'firebase/firestore'

export const logFirestoreContext = async () => {
    console.group('🔐 Firestore Security Context')

    // 1. Auth context
    const currentUser = auth.currentUser
    console.log('Auth Status:', {
        isSignedIn: !!currentUser,
        uid: currentUser?.uid || 'NOT_SIGNED_IN',
        email: currentUser?.email || 'N/A'
    })

    if (!currentUser) {
        console.warn('⚠️ User is not authenticated. Firestore will deny all requests.')
        console.groupEnd()
        return null
    }

    try {
        // 2. User document
        const userRef = doc(db, 'users', currentUser.uid)
        const userSnap = await getDoc(userRef)
        const userData = userSnap.data()

        console.log('User Document:', {
            exists: userSnap.exists(),
            uid: userSnap.id,
            organizationId: userData?.organizationId || 'MISSING ⚠️',
            role: userData?.role || 'MISSING ⚠️',
            fullName: userData?.fullName || 'N/A'
        })

        if (!userData?.organizationId) {
            console.error('❌ CRITICAL: User document is missing organizationId field!')
            console.error('This will cause all Firestore queries to fail with permission denied.')
        }

        // 3. Organization document
        if (userData?.organizationId) {
            const orgRef = doc(db, 'organizations', userData.organizationId)
            const orgSnap = await getDoc(orgRef)

            console.log('Organization Document:', {
                organizationId: userData.organizationId,
                exists: orgSnap.exists(),
                name: orgSnap.data()?.name || 'N/A',
                type: orgSnap.data()?.type || 'N/A'
            })

            if (!orgSnap.exists()) {
                console.warn('⚠️ Organization document does not exist!')
                console.warn(`The organization with ID "${userData.organizationId}" was not found.`)
            }
        }

        // 4. Summary
        console.log('\n✅ Security Context Ready for Queries')
        console.table({
            'Auth UID': currentUser.uid,
            'Organization ID': userData?.organizationId || 'MISSING',
            'Ready for Queries': !!userData?.organizationId ? '✅ YES' : '❌ NO'
        })

        console.groupEnd()

        return {
            uid: currentUser.uid,
            organizationId: userData?.organizationId,
            isReady: !!userData?.organizationId
        }
    } catch (error) {
        console.error('❌ Error loading Firestore context:', error.message)
        console.groupEnd()
        throw error
    }
}

export const validateQueryReadiness = async () => {
    console.group('📋 Query Readiness Check')

    try {
        const context = await logFirestoreContext()

        if (!context) {
            console.log('❌ Not ready: User is not authenticated')
            console.groupEnd()
            return { ready: false, reason: 'NOT_AUTHENTICATED' }
        }

        if (!context.organizationId) {
            console.log('❌ Not ready: User has no organizationId')
            console.groupEnd()
            return { ready: false, reason: 'NO_ORGANIZATION_ID' }
        }

        console.log('✅ Ready to execute Firestore queries')
        console.log(`  ├─ Auth UID: ${context.uid}`)
        console.log(`  └─ Organization ID: ${context.organizationId}`)

        console.groupEnd()

        return { ready: true, context }
    } catch (error) {
        console.error('Error checking readiness:', error.message)
        console.groupEnd()
        return { ready: false, reason: 'ERROR', error }
    }
}

export const logFirestoreError = (error, context = {}) => {
    console.group('🚨 Firestore Error Details')
    console.error({
        code: error.code,
        message: error.message,
        name: error.name,
        ...context
    })

    // Common error diagnostics
    if (error.code === 'permission-denied') {
        console.error('❌ Permission Denied')
        console.error('Possible causes:')
        console.error('  1. User is not authenticated (check auth.currentUser)')
        console.error('  2. User document is missing organizationId field')
        console.error('  3. Query uses wrong organizationId (case sensitivity)')
        console.error('  4. Emergency document is missing organizationId field')
        console.error('  5. Emergency organizationId does not match user organizationId')
    } else if (error.code === 'not-found') {
        console.error('❌ Document Not Found')
        console.error('The document does not exist or is not accessible.')
    } else if (error.code === 'unauthenticated') {
        console.error('❌ User is not authenticated')
        console.error('Call auth.signIn() or check auth state.')
    }

    console.groupEnd()
}

// Surface functions globally for console access
if (typeof window !== 'undefined') {
    window.__debugFirestore = {
        logContext: logFirestoreContext,
        checkReady: validateQueryReadiness,
        logError: logFirestoreError
    }
    console.log('💡 Debug tools available: window.__debugFirestore')
}
