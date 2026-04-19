import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../UserContext.jsx'
import Toast from '../components/Toast.jsx'
import Spinner from '../components/Spinner.jsx'
import EmergencyMap from '../components/EmergencyMap.jsx'
import StatusTimeline from '../components/StatusTimeline.jsx'
import {
    formatEmergencyStatus,
    getPriority,
    getPriorityColor,
    getResponseTime,
    normalizeOrganizationId,
    playAlertSound
} from '../utils/emergencyUtils.js'
import { acceptCase, fetchEmergencies, updateEmergencyStatus } from '../utils/emergencyService.js'

function StaffDashboard() {
    const [emergencies, setEmergencies] = useState([])
    const [error, setError] = useState('')
    const [assignedOnly, setAssignedOnly] = useState(false)
    const [stableOrgId, setStableOrgId] = useState(null)
    const { user, userData, loading: authLoading } = useUser()
    const navigate = useNavigate()
    const [toast, setToast] = useState(null)
    const previousCountRef = useRef(0)
    const normalizedOrgId = normalizeOrganizationId(userData?.organizationId || '')

    useEffect(() => {
        if (normalizedOrgId && normalizedOrgId !== stableOrgId) {
            setStableOrgId(normalizedOrgId)
        }

        if (!normalizedOrgId && stableOrgId) {
            setStableOrgId(null)
        }
    }, [normalizedOrgId, stableOrgId])

    useEffect(() => {
        if (!authLoading && user && !normalizedOrgId) {
            console.log('Staff Dashboard: No organization setup, redirecting')
            navigate('/organization-setup')
        }
    }, [authLoading, user, normalizedOrgId, navigate])

    useEffect(() => {
        if (authLoading || !stableOrgId || !user?.uid || !userData) {
            console.log('Staff Dashboard: Waiting for stable orgId + auth + userData', {
                stableOrgId,
                userId: user?.uid,
                userData: userData ? 'loaded' : 'missing'
            })
            return
        }

        console.log('Staff Dashboard: Setting up query for organization emergencies', {
            userId: user.uid,
            stableOrgId
        })

        try {
            const unsubscribe = fetchEmergencies({
                organizationId: stableOrgId,
                onNext: (emergencies) => {
                    console.log('Staff Dashboard: Received emergencies', {
                        count: (emergencies || []).length,
                        stableOrgId
                    })
                    setEmergencies(emergencies || [])
                    if (previousCountRef.current > 0 && (emergencies || []).length > previousCountRef.current) {
                        playAlertSound()
                        setToast({ message: 'New emergency reported', type: 'warning' })
                    }
                    previousCountRef.current = (emergencies || []).length
                },
                onError: (error) => {
                    console.error('Staff Dashboard: Firestore listener error:', error.message, { code: error.code })
                    setError(`Unable to load emergencies: ${error.message}`)
                }
            })

            return unsubscribe
        } catch (err) {
            console.error('Staff Dashboard: Query setup error:', err.message)
            setError(`Query error: ${err.message}`)
        }
    }, [authLoading, stableOrgId, user?.uid, userData])

    const actor = {
        uid: user?.uid,
        fullName: userData?.fullName || user?.displayName || 'Staff Member',
        organizationId: stableOrgId,
        role: userData?.role || 'staff'
    }

    const handleAcceptCase = async (caseId) => {
        if (!caseId) {
            setError('Invalid case ID. Please try again.')
            return
        }

        if (!stableOrgId || !user?.uid) {
            setError('Organization not set. Please complete organization setup.')
            return
        }

        console.log('handleAcceptCase: Accepting case', {
            caseId,
            staffId: user.uid,
            stableOrgId
        })

        setEmergencies(prevEmergencies =>
            prevEmergencies.map(emergency =>
                emergency.id === caseId
                    ? {
                        ...emergency,
                        status: 'accepted',
                        assignedStaffId: user.uid,
                        assignedStaffName: actor.fullName,
                        assignedTo: user.uid,
                        updatedAt: new Date()
                    }
                    : emergency
            )
        )

        try {
            await acceptCase(caseId, actor)

            console.log('handleAcceptCase: Successfully accepted case', caseId)
            setToast({ message: 'Case accepted successfully', type: 'success' })
            setError('')

        } catch (updateError) {
            console.error('handleAcceptCase: Failed to accept case', {
                caseId,
                error: updateError.message,
                errorCode: updateError.code,
                orgId: stableOrgId,
                staffId: user.uid
            })

            // Revert optimistic update on failure
            setEmergencies(prevEmergencies =>
                prevEmergencies.map(emergency =>
                    emergency.id === caseId
                        ? { ...emergency, status: 'pending', assignedStaffId: null, assignedStaffName: '', assignedTo: null }
                        : emergency
                )
            )

            const errorMessage = updateError.code === 'permission-denied'
                ? 'Permission denied. You may not have access to this case.'
                : updateError.code === 'not-found'
                    ? 'Case not found. It may have been deleted.'
                    : `Failed to accept case: ${updateError.message}`

            setError(errorMessage)
            setToast({ message: 'Failed to accept case', type: 'error' })
        }
    }

    const handleStartResponse = async (caseId) => {
        if (!caseId) {
            console.error('handleStartResponse: caseId is undefined')
            setError('Invalid case ID. Please try again.')
            return
        }

        console.log('handleStartResponse: Starting response for case', {
            caseId,
            staffId: user.uid
        })

        // Optimistic UI update
        setEmergencies(prevEmergencies =>
            prevEmergencies.map(emergency =>
                emergency.id === caseId
                    ? { ...emergency, status: 'in_progress', updatedAt: new Date() }
                    : emergency
            )
        )

        try {
            await updateEmergencyStatus({
                emergencyId: caseId,
                status: 'in_progress',
                actor
            })

            console.log('handleStartResponse: Successfully started response for case', caseId)
            setToast({ message: 'Response started', type: 'success' })
            setError('')

        } catch (updateError) {
            console.error('handleStartResponse: Failed to start response', {
                caseId,
                error: updateError,
                errorCode: updateError.code,
                errorMessage: updateError.message
            })

            // Revert optimistic update on failure
            setEmergencies(prevEmergencies =>
                prevEmergencies.map(emergency =>
                    emergency.id === caseId
                        ? { ...emergency, status: 'accepted' }
                        : emergency
                )
            )

            const errorMessage = updateError.code === 'permission-denied'
                ? 'Permission denied. You may not have access to this case.'
                : updateError.code === 'not-found'
                    ? 'Case not found. It may have been deleted.'
                    : `Failed to start response: ${updateError.message}`

            setError(errorMessage)
            setToast({ message: 'Failed to start response', type: 'error' })
        }
    }

    const handleResolveCase = async (caseId) => {
        if (!caseId) {
            console.error('handleResolveCase: caseId is undefined')
            setError('Invalid case ID. Please try again.')
            return
        }

        console.log('handleResolveCase: Resolving case', {
            caseId,
            staffId: user.uid
        })

        // Optimistic UI update
        setEmergencies(prevEmergencies =>
            prevEmergencies.map(emergency =>
                emergency.id === caseId
                    ? { ...emergency, status: 'resolved', updatedAt: new Date() }
                    : emergency
            )
        )

        try {
            await updateEmergencyStatus({
                emergencyId: caseId,
                status: 'resolved',
                actor
            })

            console.log('handleResolveCase: Successfully resolved case', caseId)
            setToast({ message: 'Case resolved successfully', type: 'success' })
            setError('')

        } catch (updateError) {
            console.error('handleResolveCase: Failed to resolve case', {
                caseId,
                error: updateError,
                errorCode: updateError.code,
                errorMessage: updateError.message
            })

            // Revert optimistic update on failure
            setEmergencies(prevEmergencies =>
                prevEmergencies.map(emergency =>
                    emergency.id === caseId
                        ? { ...emergency, status: 'in_progress' }
                        : emergency
                )
            )

            const errorMessage = updateError.code === 'permission-denied'
                ? 'Permission denied. You may not have access to this case.'
                : updateError.code === 'not-found'
                    ? 'Case not found. It may have been deleted.'
                    : `Failed to resolve case: ${updateError.message}`

            setError(errorMessage)
            setToast({ message: 'Failed to resolve case', type: 'error' })
        }
    }

    const displayedEmergencies = assignedOnly
        ? (emergencies || []).filter((emergency) => emergency.assignedStaffId === user?.uid)
        : (emergencies || [])

    // Calculate stats for staff dashboard
    const assignedCount = emergencies.filter((emergency) => emergency.assignedStaffId === user?.uid).length
    const activeCount = displayedEmergencies.filter((e) => e.status !== 'resolved').length
    const resolvedCount = displayedEmergencies.filter((e) => e.status === 'resolved').length

    if (authLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <div className="text-center">
                    <Spinner />
                    <p className="mt-4 text-slate-300">Loading your dashboard...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-7xl px-6 py-10 text-slate-100">
            {/* Enhanced Header */}
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 shadow-2xl backdrop-blur-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                <span className="text-xl font-bold text-white">👨‍⚕️</span>
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                                    Staff Dashboard
                                </h1>
                                <p className="text-slate-300 text-lg">{userData?.organizationName || "Organization doesn't exist"}</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400">Emergency Response Team • {userData?.role || 'staff'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setAssignedOnly((prev) => !prev)}
                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 hover:scale-105 border ${assignedOnly
                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30 border-green-500/30'
                                : 'bg-slate-800/50 text-slate-300 border-white/10 hover:border-white/20 hover:bg-slate-700/50'
                                }`}
                        >
                            {assignedOnly ? 'Show All Cases' : 'My Assignments'}
                        </button>
                        <button
                            onClick={() => navigate('/organization-setup')}
                            className="rounded-xl bg-slate-700/50 px-4 py-2 text-sm font-semibold text-slate-300 transition-all duration-300 hover:scale-105 hover:bg-slate-600/50 border border-white/10 hover:border-white/20"
                        >
                            Change Organization
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <div className="text-4xl font-bold text-blue-400 mb-2">{assignedCount}</div>
                    <p className="text-slate-300 font-medium">My Assignments</p>
                    <div className="mt-3 h-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"></div>
                </div>
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <div className="text-4xl font-bold text-orange-400 mb-2">{activeCount}</div>
                    <p className="text-slate-300 font-medium">Active Cases</p>
                    <div className="mt-3 h-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
                </div>
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <div className="text-4xl font-bold text-emerald-400 mb-2">{resolvedCount}</div>
                    <p className="text-slate-300 font-medium">Resolved Today</p>
                    <div className="mt-3 h-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full"></div>
                </div>
            </div>

            {/* Map Section */}
            <div className="mt-8 rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-6 shadow-2xl backdrop-blur-sm">
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-white">Live Emergency Map</h2>
                    <p className="text-slate-300 text-sm">Real-time location tracking and response coordination</p>
                </div>
                <EmergencyMap emergencies={displayedEmergencies} />
            </div>

            {error && <p className="mt-6 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-200">{error}</p>}

            {/* Emergency Cases */}
            <div className="mt-8 rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 shadow-2xl backdrop-blur-sm">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Emergency Cases</h2>
                    <p className="text-slate-300">{assignedOnly ? 'Your assigned emergencies' : 'All organization emergencies'}</p>
                </div>

                {displayedEmergencies.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-slate-950/80 p-12 text-center transition-all duration-300 hover:-translate-y-1">
                        <div className="text-6xl mb-4">{assignedOnly ? '📋' : '🎉'}</div>
                        <p className="text-slate-300 text-xl font-medium">{assignedOnly ? 'No assigned cases' : 'All clear!'}</p>
                        <p className="text-slate-400 text-sm mt-2">{assignedOnly ? 'You have no active assignments.' : 'No emergencies to handle right now.'}</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {displayedEmergencies.map((emergency) => {
                            const statusColors = {
                                'pending': 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
                                'accepted': 'text-blue-300 bg-blue-500/10 border-blue-500/20',
                                in_progress: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
                                'resolved': 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                            }
                            return (
                                <div key={emergency.id} className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-950/80 to-slate-900/80 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={`w-4 h-4 rounded-full ${emergency.emergencyType === 'Fire' ? 'bg-red-500' :
                                                    emergency.emergencyType === 'Medical' ? 'bg-red-500' :
                                                        emergency.emergencyType === 'Security' ? 'bg-yellow-500' : 'bg-green-500'
                                                    }`}></div>
                                                <div>
                                                    <p className="text-lg font-bold text-white">{emergency.userName || emergency.userId}</p>
                                                    <p className="text-slate-400 text-sm">Reported: {emergency.emergencyType || 'General'} Emergency</p>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(getPriority(emergency.emergencyType))}`}>
                                                    {getPriority(emergency.emergencyType)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
                                                <div>
                                                    <p className="text-slate-500">Contact</p>
                                                    <p className="text-slate-300 font-medium">{emergency.phone || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Location</p>
                                                    <p className="text-slate-300 font-medium">{emergency.latitude?.toFixed(4) ?? 'N/A'}, {emergency.longitude?.toFixed(4) ?? 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Status</p>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[emergency.status] || 'text-slate-300'}`}>
                                                        {formatEmergencyStatus(emergency.status || 'pending')}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-slate-500">Response Time</p>
                                                    <p className="text-slate-300 font-medium">{getResponseTime(emergency.createdAt)}</p>
                                                </div>
                                            </div>
                                            {emergency.description && (
                                                <div className="bg-slate-900/50 rounded-lg p-3 border border-white/5">
                                                    <p className="text-slate-300 text-sm">{emergency.description}</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-3 sm:ml-6">
                                            <div className="flex flex-col gap-2">
                                                {emergency.status === 'pending' && !emergency.assignedStaffId && (
                                                    <button
                                                        onClick={() => handleAcceptCase(emergency.id)}
                                                        className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-105 hover:shadow-blue-500/50"
                                                    >
                                                        Accept Case
                                                    </button>
                                                )}
                                                {(emergency.assignedStaffId === user?.uid) && (emergency.status === 'accepted') && (
                                                    <button
                                                        onClick={() => handleStartResponse(emergency.id)}
                                                        className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/30 transition-all duration-300 hover:scale-105 hover:shadow-sky-500/50"
                                                    >
                                                        Start Response
                                                    </button>
                                                )}
                                                {(emergency.assignedStaffId === user?.uid) && emergency.status !== 'resolved' && (
                                                    <button
                                                        onClick={() => handleResolveCase(emergency.id)}
                                                        className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:scale-105 hover:shadow-emerald-500/50"
                                                    >
                                                        Mark Resolved
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <StatusTimeline status={emergency.status} />
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    )
}

export default StaffDashboard
