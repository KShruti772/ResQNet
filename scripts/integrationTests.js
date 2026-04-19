/**
 * Emergency System Integration Tests
 * 
 * Comprehensive test suite for:
 * - Firestore rules enforcement
 * - Emergency CRUD operations
 * - Permission validation
 * - Data consistency
 * 
 * Usage: Import and call runTests() after authentication
 * Run in browser console or as part of automated testing
 */

import { auth, db } from '../src/firebase.js'
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    serverTimestamp,
    deleteDoc
} from 'firebase/firestore'

let testResults = {
    passed: 0,
    failed: 0,
    tests: []
}

const log = (testName, passed, message) => {
    const result = {
        name: testName,
        passed,
        message
    }
    testResults.tests.push(result)

    if (passed) {
        testResults.passed++
        console.log(`✅ ${testName}: ${message}`)
    } else {
        testResults.failed++
        console.error(`❌ ${testName}: ${message}`)
    }
}

export const runTests = async () => {
    console.clear()
    console.log(
        '%c🧪 Emergency System Integration Tests',
        'font-size: 18px; font-weight: bold; color: #1f2937;'
    )
    console.log('%c' + '='.repeat(70), 'color: #9ca3af;')

    testResults = { passed: 0, failed: 0, tests: [] }

    const user = auth.currentUser
    if (!user) {
        console.error('❌ User is not authenticated. Please sign in first.')
        return
    }

    try {
        console.log('📋 Initializing Tests...\n')

        // Load user data
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)
        const userData = userSnap.data()

        if (!userData) {
            console.error('❌ User document not found')
            return
        }

        // Test 1: User Profile
        console.group('Test Suite 1: User Profile')
        await testUserProfile(user, userData)
        console.groupEnd()

        // Test 2: Organization
        console.group('Test Suite 2: Organization')
        await testOrganization(userData)
        console.groupEnd()

        // Test 3: Emergency Read Permissions
        console.group('Test Suite 3: Emergency Read Permissions')
        await testEmergencyReadPermissions(userData)
        console.groupEnd()

        // Test 4: Emergency Create (with cleanup)
        console.group('Test Suite 4: Emergency Create/Update/Delete')
        await testEmergencyCRUD(user, userData)
        console.groupEnd()

        // Test 5: Data Consistency
        console.group('Test Suite 5: Data Consistency')
        await testDataConsistency(userData)
        console.groupEnd()

        // Summary
        console.log('%c' + '='.repeat(70), 'color: #9ca3af;')
        await printTestSummary()
    } catch (error) {
        console.error('Test suite error:', error.message)
    }
}

async function testUserProfile(user, userData) {
    log(
        'User authentication',
        user.uid && user.email,
        `UID: ${user.uid.substring(0, 8)}...`
    )

    log(
        'User document exists',
        userData && Object.keys(userData).length > 0,
        `${Object.keys(userData || {}).length} fields`
    )

    log(
        'User has organizationId',
        !!userData?.organizationId,
        userData?.organizationId || 'MISSING'
    )

    log(
        'User has role',
        !!userData?.role,
        userData?.role || 'MISSING'
    )

    log(
        'organizationId format',
        typeof userData?.organizationId === 'string' && userData.organizationId.length > 0,
        `"${userData?.organizationId}" (${typeof userData?.organizationId})`
    )
}

async function testOrganization(userData) {
    if (!userData?.organizationId) {
        log('Organization lookup', false, 'Cannot test - user has no organizationId')
        return
    }

    try {
        const orgRef = doc(db, 'organizations', userData.organizationId)
        const orgSnap = await getDoc(orgRef)

        log(
            'Organization document exists',
            orgSnap.exists(),
            orgSnap.exists() ? orgSnap.data().name : 'NOT FOUND'
        )

        log(
            'Organization has memberCount',
            orgSnap.exists() && typeof orgSnap.data()?.memberCount === 'number',
            orgSnap.exists() ? `${orgSnap.data().memberCount} members` : 'N/A'
        )
    } catch (error) {
        log('Organization lookup', false, error.code)
    }
}

async function testEmergencyReadPermissions(userData) {
    if (!userData?.organizationId) {
        log('Query emergencies by organizationId', false, 'User has no organizationId')
        return
    }

    try {
        const emergenciesQuery = query(
            collection(db, 'emergencies'),
            where('organizationId', '==', userData.organizationId)
        )

        const emergenciesSnap = await getDocs(emergenciesQuery)

        log(
            'Query emergencies by organizationId',
            true,
            `Retrieved ${emergenciesSnap.size} emergencies`
        )

        // Check document structure
        if (emergenciesSnap.size > 0) {
            const firstEmergency = emergenciesSnap.docs[0].data()

            log(
                'Emergency documents have organizationId field',
                !!firstEmergency.organizationId,
                firstEmergency.organizationId || 'MISSING'
            )

            log(
                'Emergency documents have userId field',
                !!firstEmergency.userId,
                firstEmergency.userId ? firstEmergency.userId.substring(0, 8) + '...' : 'MISSING'
            )

            log(
                'Emergency documents have status field',
                !!firstEmergency.status,
                firstEmergency.status || 'MISSING'
            )

            log(
                'Emergency documents have createdAt field',
                !!firstEmergency.createdAt,
                firstEmergency.createdAt ? 'timestamp' : 'MISSING'
            )
        }
    } catch (error) {
        log('Query emergencies by organizationId', false, `${error.code}: ${error.message}`)
    }
}

async function testEmergencyCRUD(user, userData) {
    if (!userData?.organizationId) {
        log('Create emergency', false, 'User has no organizationId')
        return
    }

    let testEmergencyId = null

    try {
        // CREATE
        const testEmergency = {
            userId: user.uid,
            organizationId: userData.organizationId,
            emergencyType: 'TEST_FIRE',
            location: 'Test Location',
            description: 'Automated test emergency - can be deleted',
            status: 'pending',
            severity: 'high',
            createdAt: serverTimestamp()
        }

        const docRef = await addDoc(collection(db, 'emergencies'), testEmergency)
        testEmergencyId = docRef.id

        log('Create emergency', true, `Created ${testEmergencyId}`)

        // Verify it exists
        const createdSnap = await getDoc(doc(db, 'emergencies', testEmergencyId))
        log('Read created emergency', createdSnap.exists(), 'Emergency readable after creation')

        // UPDATE
        await updateDoc(doc(db, 'emergencies', testEmergencyId), {
            status: 'acknowledged'
        })

        const updatedSnap = await getDoc(doc(db, 'emergencies', testEmergencyId))
        const updatedData = updatedSnap.data()

        log(
            'Update emergency status',
            updatedData?.status === 'acknowledged',
            `Status updated to ${updatedData?.status}`
        )

        // Verify organizationId cannot be changed
        try {
            await updateDoc(doc(db, 'emergencies', testEmergencyId), {
                organizationId: 'INVALID_ORG'
            })
            log('Prevent organizationId change', false, 'Update succeeded (should have failed)')
        } catch (error) {
            log(
                'Prevent organizationId change',
                error.code === 'permission-denied',
                'Update correctly rejected'
            )
        }

        // DELETE
        await deleteDoc(doc(db, 'emergencies', testEmergencyId))
        const deletedSnap = await getDoc(doc(db, 'emergencies', testEmergencyId))
        log('Delete emergency', !deletedSnap.exists(), 'Emergency deleted successfully')
    } catch (error) {
        if (testEmergencyId) {
            try {
                await deleteDoc(doc(db, 'emergencies', testEmergencyId))
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        log('Emergency CRUD', false, `${error.code}: ${error.message}`)
    }
}

async function testDataConsistency(userData) {
    if (!userData?.organizationId) {
        log('Scan for data issues', false, 'User has no organizationId')
        return
    }

    try {
        const emergenciesQuery = query(
            collection(db, 'emergencies'),
            where('organizationId', '==', userData.organizationId)
        )

        const emergenciesSnap = await getDocs(emergenciesQuery)
        const emergencies = emergenciesSnap.docs.map((doc) => doc.data())

        if (emergencies.length === 0) {
            log('Data consistency check', true, 'No emergencies to check')
            return
        }

        const issues = {
            missingOrganizationId: 0,
            missingUserId: 0,
            missingStatus: 0,
            missingCreatedAt: 0
        }

        emergencies.forEach((em) => {
            if (!em.organizationId) issues.missingOrganizationId++
            if (!em.userId) issues.missingUserId++
            if (!em.status) issues.missingStatus++
            if (!em.createdAt) issues.missingCreatedAt++
        })

        const hasIssues = Object.values(issues).some((count) => count > 0)

        log(
            'All emergencies have required fields',
            !hasIssues,
            `Checked ${emergencies.length} documents: ${JSON.stringify(issues)}`
        )
    } catch (error) {
        log('Data consistency check', false, error.code)
    }
}

async function printTestSummary() {
    const total = testResults.passed + testResults.failed

    console.log('%cTest Results Summary', 'font-size: 16px; font-weight: bold; color: #1f2937;')
    console.log(`Total Tests: ${total}`)
    console.log(`✅ Passed: ${testResults.passed}`)
    console.log(`❌ Failed: ${testResults.failed}`)
    console.log(`Success Rate: ${((testResults.passed / total) * 100).toFixed(1)}%`)

    console.log('\n%cDetailed Results:', 'font-weight: bold;')
    console.table(testResults.tests)

    if (testResults.failed === 0) {
        console.log('%c🎉 All tests passed!', 'color: #10b981; font-size: 16px; font-weight: bold;')
    } else {
        console.log(
            '%c⚠️ Some tests failed. Check Firestore rules and data consistency.',
            'color: #ef4444; font-size: 16px; font-weight: bold;'
        )
    }

    console.log('%c' + '='.repeat(70), 'color: #9ca3af;')

    // Export results to window for programmatic access
    if (typeof window !== 'undefined') {
        window.lastTestResults = testResults
        console.log('📊 Test results saved to window.lastTestResults')
    }

    return testResults
}

// Install test function globally
export const installTestTools = () => {
    if (typeof window !== 'undefined') {
        window.runEmergencyTests = runTests
        console.log('💡 Test suite installed: call runEmergencyTests() in console')
    }
}
