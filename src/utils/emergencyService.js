import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    onSnapshot,
    query,
    where,
    runTransaction,
    serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase.js'
import {
    normalizeEmergencyStatus,
    normalizeOrganizationId
} from './emergencyUtils.js'

export const LOCAL_ORGANIZATION_KEY = 'orgId'

export const storeOrganizationId = (organizationId) => {
    const normalizedOrganizationId = normalizeOrganizationId(organizationId || '')

    if (normalizedOrganizationId) {
        localStorage.setItem(LOCAL_ORGANIZATION_KEY, normalizedOrganizationId)
    } else {
        localStorage.removeItem(LOCAL_ORGANIZATION_KEY)
    }

    return normalizedOrganizationId
}

export const getStoredOrganizationId = () => {
    return localStorage.getItem(LOCAL_ORGANIZATION_KEY) || ''
}

export const getUserProfile = async (userId) => {
    if (!userId) {
        throw new Error('User ID is required to load profile')
    }

    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    const userData = userSnap.data()

    if (!userData) {
        throw new Error('User profile not found')
    }

    return userData
}

export const normalizeEmergencyRecord = (emergencyId, emergency = {}) => {
    const normalizedOrganizationId = normalizeOrganizationId(emergency.organizationId || '')
    const assignedStaffId = emergency.assignedStaffId || emergency.assignedTo || null
    const assignedStaffName = emergency.assignedStaffName || emergency.assignedToName || ''
    const normalizedStatus = normalizeEmergencyStatus(emergency.status)
    const location = emergency.location
        || (typeof emergency.latitude === 'number' && typeof emergency.longitude === 'number'
            ? `${emergency.latitude.toFixed(6)}, ${emergency.longitude.toFixed(6)}`
            : '')

    return {
        id: emergencyId,
        ...emergency,
        organizationId: normalizedOrganizationId,
        status: normalizedStatus,
        assignedStaffId,
        assignedStaffName,
        assignedTo: assignedStaffId,
        location
    }
}

const sortEmergenciesByCreatedAt = (emergencies = []) => {
    return [...emergencies].sort((left, right) => {
        const leftCreatedAt = left.createdAt?.seconds
            ? left.createdAt.seconds * 1000
            : left.createdAt instanceof Date
                ? left.createdAt.getTime()
                : left.createdAt || 0

        const rightCreatedAt = right.createdAt?.seconds
            ? right.createdAt.seconds * 1000
            : right.createdAt instanceof Date
                ? right.createdAt.getTime()
                : right.createdAt || 0

        return rightCreatedAt - leftCreatedAt
    })
}

export const createEmergency = async ({ user, emergencyType, description, latitude, longitude }) => {
    if (!user || !user.uid) {
        throw new Error('User must be authenticated to create an emergency')
    }

    const organizationId = normalizeOrganizationId(user.organizationId || '')

    if (!organizationId) {
        throw new Error('Organization ID is required to create an emergency')
    }

    const emergencyData = {
        userId: user.uid,
        userName: user.fullName || 'Unknown',
        phone: user.phone || 'N/A',
        emergencyType,
        description,
        latitude,
        longitude,
        location: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        status: 'pending',
        assignedStaffId: null,
        assignedStaffName: '',
        organizationId,
        organizationName: user.organizationName || 'Unknown Organization',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    }

    console.log('EmergencyService.createEmergency', {
        organizationId,
        organizationName: emergencyData.organizationName,
        userId: user.uid,
        emergencyType,
        description,
        latitude,
        longitude
    })

    const docRef = await addDoc(collection(db, 'emergencies'), emergencyData)
    return normalizeEmergencyRecord(docRef.id, emergencyData)
}

export const fetchEmergencies = ({ organizationId, userId, onNext, onError }) => {
    const normalizedOrganizationId = normalizeOrganizationId(organizationId || '')

    if (!normalizedOrganizationId) {
        const guardError = new Error('Organization ID is required to fetch emergencies')
        onError?.(guardError)
        throw guardError
    }

    console.log('EmergencyService.fetchEmergencies', {
        organizationId: normalizedOrganizationId,
        userId
    })

    const filters = [where('organizationId', '==', normalizedOrganizationId)]
    if (userId) {
        filters.push(where('userId', '==', userId))
    }

    const q = query(
        collection(db, 'emergencies'),
        ...filters
    )

    return onSnapshot(
        q,
        (snapshot) => {
            const emergencies = sortEmergenciesByCreatedAt(
                snapshot.docs.map((docSnapshot) => normalizeEmergencyRecord(docSnapshot.id, docSnapshot.data()))
            )
            console.log('EmergencyService.fetchEmergencies: received emergencies', {
                organizationId: normalizedOrganizationId,
                userId,
                count: emergencies.length,
                emergencies: emergencies.map(e => ({ id: e.id, organizationId: e.organizationId, userId: e.userId }))
            })
            onNext?.(emergencies)
        },
        (error) => {
            console.error('EmergencyService.fetchEmergencies error', {
                organizationId: normalizedOrganizationId,
                userId,
                error: error.message,
                errorCode: error.code
            })
            onError?.(error)
        }
    )
}

export const acceptCase = async (caseId, user) => {
    if (!user || !user.uid) {
        throw new Error('User must be authenticated to accept a case')
    }

    console.log('EmergencyService.acceptCase', {
        caseId,
        assignedStaffId: user.uid
    })

    const caseRef = doc(db, 'emergencies', caseId)
    const actorOrganizationId = normalizeOrganizationId(user.organizationId || '')

    await runTransaction(db, async (transaction) => {
        const caseSnap = await transaction.get(caseRef)
        if (!caseSnap.exists()) {
            throw new Error('Emergency case not found')
        }

        const emergency = normalizeEmergencyRecord(caseSnap.id, caseSnap.data())
        const organizationId = emergency.organizationId

        if (!organizationId) {
            throw new Error('Emergency case missing organization ID')
        }

        if (!actorOrganizationId || actorOrganizationId !== organizationId) {
            throw new Error('You can only accept emergencies from your organization')
        }

        if (emergency.assignedStaffId && emergency.assignedStaffId !== user.uid) {
            throw new Error('This emergency has already been assigned')
        }

        if (emergency.status !== 'pending' && emergency.assignedStaffId !== user.uid) {
            throw new Error('Only pending emergencies can be accepted')
        }

        const updateData = {
            status: 'accepted',
            assignedStaffId: user.uid,
            assignedStaffName: user.fullName || user.displayName || 'Staff Member',
            updatedAt: serverTimestamp()
        }

        transaction.update(caseRef, updateData)
    })

    console.log('EmergencyService.acceptCase success', { caseId })
    return {
        caseId,
        status: 'accepted',
        assignedStaffId: user.uid,
        assignedStaffName: user.fullName || user.displayName || 'Staff Member'
    }
}

export const updateEmergencyStatus = async ({ emergencyId, status, actor }) => {
    if (!actor?.uid) {
        throw new Error('Authenticated user is required to update emergency status')
    }

    const normalizedStatus = normalizeEmergencyStatus(status)
    const emergencyRef = doc(db, 'emergencies', emergencyId)
    const actorOrganizationId = normalizeOrganizationId(actor.organizationId || '')

    await runTransaction(db, async (transaction) => {
        const emergencySnap = await transaction.get(emergencyRef)
        if (!emergencySnap.exists()) {
            throw new Error('Emergency case not found')
        }

        const emergency = normalizeEmergencyRecord(emergencySnap.id, emergencySnap.data())

        if (!actorOrganizationId || emergency.organizationId !== actorOrganizationId) {
            throw new Error('You can only update emergencies from your organization')
        }

        const actorRole = actor.role || 'user'
        const isAdmin = actorRole === 'admin'
        const isAssignedStaff = emergency.assignedStaffId === actor.uid

        if (!isAdmin && !isAssignedStaff) {
            throw new Error('Only the assigned staff member or an admin can update this emergency')
        }

        const updateData = {
            status: normalizedStatus,
            updatedAt: serverTimestamp()
        }

        transaction.update(emergencyRef, updateData)
    })
}

export const assignEmergencyToStaff = async ({ emergencyId, staffUser, actor }) => {
    if (!actor?.uid || actor.role !== 'admin') {
        throw new Error('Only admins can assign emergencies')
    }

    if (!staffUser?.uid) {
        throw new Error('A staff member must be selected before assigning')
    }

    const actorOrganizationId = normalizeOrganizationId(actor.organizationId || '')
    const staffOrganizationId = normalizeOrganizationId(staffUser.organizationId || '')
    const emergencyRef = doc(db, 'emergencies', emergencyId)

    await runTransaction(db, async (transaction) => {
        const emergencySnap = await transaction.get(emergencyRef)
        if (!emergencySnap.exists()) {
            throw new Error('Emergency case not found')
        }

        const emergency = normalizeEmergencyRecord(emergencySnap.id, emergencySnap.data())

        if (!actorOrganizationId || emergency.organizationId !== actorOrganizationId) {
            throw new Error('You can only assign emergencies from your organization')
        }

        if (!staffOrganizationId || staffOrganizationId !== emergency.organizationId) {
            throw new Error('Selected staff member does not belong to this organization')
        }

        if (emergency.assignedStaffId && emergency.assignedStaffId !== staffUser.uid) {
            throw new Error('This emergency has already been assigned')
        }

        const updateData = {
            status: emergency.status === 'pending' ? 'accepted' : emergency.status,
            assignedStaffId: staffUser.uid,
            assignedStaffName: staffUser.fullName || staffUser.displayName || 'Staff Member',
            updatedAt: serverTimestamp()
        }

        transaction.update(emergencyRef, updateData)
    })
}

export const fetchOrganizationStaff = async (organizationId) => {
    const normalizedOrganizationId = normalizeOrganizationId(organizationId || '')

    if (!normalizedOrganizationId) {
        return []
    }

    const staffQuery = query(
        collection(db, 'users'),
        where('organizationId', '==', normalizedOrganizationId)
    )

    const snapshot = await getDocs(staffQuery)

    return snapshot.docs
        .map((staffSnapshot) => ({
            uid: staffSnapshot.id,
            ...staffSnapshot.data(),
            organizationId: normalizeOrganizationId(staffSnapshot.data().organizationId || '')
        }))
        .filter((staffUser) => staffUser.role === 'staff')
}
