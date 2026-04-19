/**
 * Firestore Data Fix Script - Emergency Organization IDs
 * 
 * Purpose: Validate and fix missing or incorrect organizationId fields in emergencies collection
 * 
 * Usage:
 * 1. Run in Firebase Cloud Functions or as a one-time admin task
 * 2. Or paste in browser console after authenticating as admin
 * 3. Or integrate into your admin dashboard
 * 
 * WARNING: Always backup your Firestore database before running data fixes!
 */

import { db, auth } from '../src/firebase.js'
import { collection, query, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore'
import { normalizeEmergencyStatus, normalizeOrganizationId } from '../src/utils/emergencyUtils.js'

export const validateEmergencyData = async () => {
    if (!auth.currentUser) {
        console.error('❌ User is not authenticated')
        return
    }

    console.log('🔍 Scanning emergencies collection for data inconsistencies...')

    try {
        const emergenciesRef = collection(db, 'emergencies')
        const q = query(emergenciesRef)
        const snapshot = await getDocs(q)

        const issues = []
        const fixes = []

        snapshot.forEach((docSnap) => {
            const data = docSnap.data()
            const emergencyId = docSnap.id

            // Check for missing organizationId
            if (!data.organizationId) {
                issues.push({
                    id: emergencyId,
                    issue: 'Missing organizationId',
                    userId: data.userId,
                    createdAt: data.createdAt
                })
            }

            // Check for missing userId
            if (!data.userId) {
                issues.push({
                    id: emergencyId,
                    issue: 'Missing userId',
                    createdAt: data.createdAt
                })
            }

            // Check for missing status
            if (!data.status) {
                issues.push({
                    id: emergencyId,
                    issue: 'Missing status',
                    organizationId: data.organizationId,
                    userId: data.userId
                })
            }
        })

        console.log(`\n📊 Data Validation Report`)
        console.log(`Total emergencies scanned: ${snapshot.docs.length}`)
        console.log(`Issues found: ${issues.length}`)

        if (issues.length > 0) {
            console.log('\n⚠️ Issues detected:')
            issues.forEach((issue) => {
                console.log(`  - [${issue.id}] ${issue.issue}`)
            })
        } else {
            console.log('✅ No issues found. All emergency documents are valid!')
        }

        return {
            totalScanned: snapshot.docs.length,
            issuesCount: issues.length,
            issues
        }
    } catch (error) {
        console.error('❌ Error scanning emergencies:', error.message)
        throw error
    }
}

export const fixMissingOrganizationIds = async () => {
    if (!auth.currentUser) {
        console.error('❌ User is not authenticated')
        return
    }

    console.log('🔧 Attempting to fix missing organizationIds...')

    try {
        const emergenciesRef = collection(db, 'emergencies')
        const q = query(emergenciesRef)
        const snapshot = await getDocs(q)

        let fixed = 0
        let failed = 0

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data()

            // Skip if already has organizationId
            if (data.organizationId) {
                continue
            }

            try {
                // Try to find the user and get their organizationId
                if (data.userId) {
                    const userRef = doc(db, 'users', data.userId)
                    const userSnap = await getDoc(userRef)
                    const userData = userSnap.data()

                    if (userData?.organizationId) {
                        await updateDoc(doc(db, 'emergencies', docSnap.id), {
                            organizationId: normalizeOrganizationId(userData.organizationId)
                        })
                        console.log(`Fixed emergency ${docSnap.id}: Added organizationId=${normalizeOrganizationId(userData.organizationId)}`)
                        fixed++
                    } else {
                        console.warn(`⚠️ Cannot fix ${docSnap.id}: User ${data.userId} has no organizationId`)
                        failed++
                    }
                }
            } catch (error) {
                console.error(`❌ Error fixing ${docSnap.id}:`, error.message)
                failed++
            }
        }

        console.log(`\n📋 Fix Summary`)
        console.log(`Fixed: ${fixed}`)
        console.log(`Failed: ${failed}`)

        return { fixed, failed }
    } catch (error) {
        console.error('❌ Error during fix process:', error.message)
        throw error
    }
}

export const ensureEmergencyDefaults = async () => {
    if (!auth.currentUser) {
        console.error('❌ User is not authenticated')
        return
    }

    console.log('🔄 Ensuring all emergency documents have required fields...')

    try {
        const emergenciesRef = collection(db, 'emergencies')
        const q = query(emergenciesRef)
        const snapshot = await getDocs(q)

        let updated = 0

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data()
            const updates = {}

            // Ensure status exists
            if (!data.status) {
                updates.status = 'pending'
            } else if (data.status !== normalizeEmergencyStatus(data.status)) {
                updates.status = normalizeEmergencyStatus(data.status)
            }

            // Ensure organizationId exists
            if (!data.organizationId && data.userId) {
                const userRef = doc(db, 'users', data.userId)
                const userSnap = await getDoc(userRef)
                const userData = userSnap.data()
                if (userData?.organizationId) {
                    updates.organizationId = normalizeOrganizationId(userData.organizationId)
                }
            } else if (data.organizationId) {
                updates.organizationId = normalizeOrganizationId(data.organizationId)
            }

            if (Object.keys(updates).length > 0) {
                await updateDoc(doc(db, 'emergencies', docSnap.id), updates)
                console.log(`✅ Updated emergency ${docSnap.id}:`, updates)
                updated++
            }
        }

        console.log(`\n📋 Update Summary: ${updated} documents updated`)
        return { updated }
    } catch (error) {
        console.error('❌ Error during update process:', error.message)
        throw error
    }
}

// Export for use in browser console or Node.js
console.log('📌 Available functions:')
console.log('  1. validateEmergencyData() - Scan for issues')
console.log('  2. fixMissingOrganizationIds() - Fix missing orgIds')
console.log('  3. ensureEmergencyDefaults() - Ensure all required fields')
