import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../UserContext.jsx'
import Toast from '../components/Toast.jsx'
import OfflineIndicator from '../components/OfflineIndicator.jsx'
import Spinner from '../components/Spinner.jsx'
import EmergencyMap from '../components/EmergencyMap.jsx'
import StatusTimeline from '../components/StatusTimeline.jsx'
import {
    formatEmergencyStatus,
    getPriority,
    getPriorityColor,
    getResponseTime,
    normalizeOrganizationId,
    playAlertSound,
    formatEventType,
    formatEventTimestamp,
    getEventIcon
} from '../utils/emergencyUtils.js'
import {
    assignEmergencyToStaff,
    createEmergency,
    fetchEmergencies,
    fetchOrganizationStaff,
    updateEmergencyStatus,
    getAnalytics,
    getStaffPerformance
} from '../utils/emergencyService.js'

function AdminDashboard() {
    const [emergencies, setEmergencies] = useState([])
    const [error, setError] = useState('')
    const [filter, setFilter] = useState('all')
    const [stableOrgId, setStableOrgId] = useState(null)
    const [staffOptions, setStaffOptions] = useState([])
    const [assignmentSelections, setAssignmentSelections] = useState({})
    const [analytics, setAnalytics] = useState({
        total_incidents: 0,
        avg_response_time: 0,
        escalation_rate: 0
    })
    const [staffPerformance, setStaffPerformance] = useState([])
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
            console.log('Admin Dashboard: No organization setup, redirecting')
            navigate('/organization-setup')
        }
    }, [authLoading, user, normalizedOrgId, navigate])

    useEffect(() => {
        if (authLoading || !stableOrgId || !user?.uid || !userData) {
            console.log('Admin Dashboard: Waiting for stable orgId + auth + userData', {
                stableOrgId,
                userId: user?.uid,
                userData: userData ? 'loaded' : 'missing'
            })
            return
        }

        console.log('Using stable orgId:', stableOrgId)

        console.log('Admin Dashboard: Setting up query for organization:', stableOrgId, {
            userId: user.uid,
            stableOrgId
        })

        try {
            const unsubscribe = fetchEmergencies({
                organizationId: stableOrgId,
                onNext: (emergencies) => {
                    console.log('Admin Dashboard: Received emergencies', {
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
                    console.error('Admin Dashboard: Firestore listener error:', error.message, { code: error.code })
                    setError(`Unable to load emergency alerts: ${error.message}`)
                }
            })
            return unsubscribe
        } catch (err) {
            console.error('Admin Dashboard: Query setup error:', err.message)
            setError(`Query error: ${err.message}`)
        }
    }, [authLoading, stableOrgId, user?.uid, userData])

    useEffect(() => {
        if (!stableOrgId) {
            setStaffOptions([])
            return
        }

        let isActive = true

        const loadStaffOptions = async () => {
            try {
                const staffUsers = await fetchOrganizationStaff(stableOrgId)
                if (isActive) {
                    setStaffOptions(staffUsers)
                }
            } catch (staffError) {
                console.error('Admin Dashboard: Failed to load staff users', staffError)
                if (isActive) {
                    setError('Failed to load organization staff.')
                }
            }
        }

        loadStaffOptions()

        return () => {
            isActive = false
        }
    }, [stableOrgId])

    useEffect(() => {
        if (!stableOrgId) {
            setAnalytics({
                total_incidents: 0,
                avg_response_time: 0,
                escalation_rate: 0
            })
            return
        }

        let isActive = true

        const loadAnalytics = async () => {
            try {
                const analyticsData = await getAnalytics(stableOrgId)
                if (isActive) {
                    setAnalytics(analyticsData)
                }
            } catch (analyticsError) {
                console.error('Admin Dashboard: Failed to load analytics', analyticsError)
                // Don't set error for analytics - it's not critical
            }
        }

        loadAnalytics()

        return () => {
            isActive = false
        }
    }, [stableOrgId])

    useEffect(() => {
        if (!stableOrgId) {
            setStaffPerformance([])
            return
        }

        let isActive = true

        const loadStaffPerformance = async () => {
            try {
                const performanceData = await getStaffPerformance(stableOrgId)
                if (isActive) {
                    setStaffPerformance(performanceData)
                }
            } catch (performanceError) {
                console.error('Admin Dashboard: Failed to load staff performance', performanceError)
                // Don't set error for performance - it's not critical
            }
        }

        loadStaffPerformance()

        return () => {
            isActive = false
        }
    }, [stableOrgId])

    const actor = {
        uid: user?.uid,
        fullName: userData?.fullName || user?.displayName || 'Admin',
        organizationId: stableOrgId,
        role: userData?.role || 'admin'
    }

    const handleUpdateStatus = async (id, status) => {
        const previousEmergency = emergencies.find((emergency) => emergency.id === id)

        setEmergencies((prevEmergencies) =>
            prevEmergencies.map((emergency) =>
                emergency.id === id
                    ? { ...emergency, status, updatedAt: new Date() }
                    : emergency
            )
        )

        try {
            await updateEmergencyStatus({
                emergencyId: id,
                status,
                actor
            })
        } catch (updateError) {
            setEmergencies((prevEmergencies) =>
                prevEmergencies.map((emergency) =>
                    emergency.id === id && previousEmergency
                        ? previousEmergency
                        : emergency
                )
            )
            setError(`Failed to update status: ${updateError.message}`)
        }
    }

    const handleAssignEmergency = async (emergency) => {
        const selectedStaffId = assignmentSelections[emergency.id]
        const selectedStaff = staffOptions.find((staffUser) => staffUser.uid === selectedStaffId)

        if (!selectedStaff) {
            setError('Please select a staff member before assigning.')
            return
        }

        const previousEmergency = emergency

        setEmergencies((prevEmergencies) =>
            prevEmergencies.map((currentEmergency) =>
                currentEmergency.id === emergency.id
                    ? {
                        ...currentEmergency,
                        status: currentEmergency.status === 'pending' ? 'accepted' : currentEmergency.status,
                        assignedStaffId: selectedStaff.uid,
                        assignedStaffName: selectedStaff.fullName || 'Staff Member',
                        assignedTo: selectedStaff.uid,
                        updatedAt: new Date()
                    }
                    : currentEmergency
            )
        )

        try {
            await assignEmergencyToStaff({
                emergencyId: emergency.id,
                staffUser: selectedStaff,
                actor
            })
            setToast({ message: 'Emergency assigned successfully', type: 'success' })
            setError('')
        } catch (assignError) {
            setEmergencies((prevEmergencies) =>
                prevEmergencies.map((currentEmergency) =>
                    currentEmergency.id === emergency.id
                        ? previousEmergency
                        : currentEmergency
                )
            )
            setError(`Failed to assign emergency: ${assignError.message}`)
            setToast({ message: 'Failed to assign emergency', type: 'error' })
        }
    }

    const createDemoEmergency = async () => {
        try {
            if (!stableOrgId || !user?.uid) {
                setError('Organization ID is not set. Please set up your organization first.')
                return
            }

            const demoTypes = ['Fire', 'Medical', 'Security', 'General']
            const randomType = demoTypes[Math.floor(Math.random() * demoTypes.length)]
            const demoDescriptions = {
                'Fire': 'Building fire reported',
                'Medical': 'Person needs immediate medical attention',
                'Security': 'Suspicious activity detected',
                'General': 'General emergency assistance needed'
            }

            const latitude = 40.7128 + (Math.random() - 0.5) * 0.1
            const longitude = -74.0060 + (Math.random() - 0.5) * 0.1

            await createEmergency({
                user: {
                    uid: user.uid,
                    organizationId: stableOrgId,
                    organizationName: userData?.organizationName || 'Unknown Organization',
                    fullName: userData?.fullName || user.displayName || 'Admin Demo',
                    phone: userData?.phone || '',
                    email: user.email || ''
                },
                emergencyType: randomType,
                description: demoDescriptions[randomType],
                latitude,
                longitude
            })

            console.log('Demo emergency created successfully', {
                userId: user.uid,
                stableOrgId,
                type: randomType
            })
            setToast({ message: 'Demo emergency created', type: 'success' })
        } catch (error) {
            console.error('Failed to create demo emergency:', error.message, {
                code: error.code,
                userId: user.uid,
                stableOrgId
            })
            setError(`Failed to create demo emergency: ${error.message}`)
        }
    }

    const filteredEmergencies = (emergencies || [])
        .filter((emergency) => {
            if (filter === 'all') return true
            return emergency.status === filter
        })
        .sort((a, b) => {
            // Critical incidents first
            if (a.is_critical && !b.is_critical) return -1
            if (!a.is_critical && b.is_critical) return 1
            // Then by creation time (newest first)
            return b.createdAt?.seconds - a.createdAt?.seconds
        })

    const total = (emergencies || []).length
    const active = (emergencies || []).filter((e) => e.status !== 'resolved').length
    const resolved = (emergencies || []).filter((e) => e.status === 'resolved').length
    const criticalCount = (emergencies || []).filter((e) => e.is_critical).length
    const avgResponseTime = resolved > 0 ? Math.floor((emergencies || []).filter(e => e.status === 'resolved').reduce((sum, e) => sum + (Date.now() - e.createdAt.seconds * 1000) / 60000, 0) / resolved) : 0

    // Show critical incident alert
    useEffect(() => {
        if (criticalCount > 0 && !toast) {
            setToast({
                message: `⚠️ ${criticalCount} critical incident${criticalCount > 1 ? 's' : ''} require${criticalCount > 1 ? '' : 's'} immediate attention`,
                type: 'error'
            })
        }
    }, [criticalCount, toast])

    const emergenciesByType = emergencies.reduce((acc, emergency) => {
        const type = emergency.emergencyType || 'General'
        acc[type] = (acc[type] || 0) + 1
        return acc
    }, {})

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
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                                <span className="text-xl font-bold text-white">👑</span>
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                                    Admin Dashboard
                                </h1>
                                <p className="text-slate-300 text-lg">{userData?.organizationName || "Organization doesn't exist"}</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400">Emergency Management Control Center • {userData?.role || 'admin'}</p>
                    </div>
                    <button
                        onClick={() => navigate('/organization-setup')}
                        className="rounded-xl bg-slate-700/50 px-4 py-2 text-sm font-semibold text-slate-300 transition-all duration-300 hover:scale-105 hover:bg-slate-600/50 border border-white/10 hover:border-white/20"
                    >
                        Change Organization
                    </button>
                </div>
            </div>

            {/* Analytics Overview */}
            <div className="mt-8">
                <h2 className="text-2xl font-bold text-white mb-6">Analytics Overview</h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        <div className="text-4xl font-bold text-cyan-400 mb-2">{analytics.total_incidents}</div>
                        <p className="text-slate-300 font-medium">Total Incidents</p>
                        <div className="mt-3 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"></div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        <div className="text-4xl font-bold text-orange-400 mb-2">{analytics.avg_response_time} min</div>
                        <p className="text-slate-300 font-medium">Avg Response Time</p>
                        <div className="mt-3 h-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        <div className="text-4xl font-bold text-emerald-400 mb-2">{analytics.escalation_rate}%</div>
                        <p className="text-slate-300 font-medium">Escalation Rate</p>
                        <div className="mt-3 h-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full"></div>
                    </div>
                </div>
            </div>

            {/* Staff Performance */}
            <div className="mt-8">
                <h2 className="text-2xl font-bold text-white mb-6">Staff Performance</h2>
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 shadow-2xl backdrop-blur-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-800/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Staff Member</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Incidents Handled</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Avg Response Time</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">Avg Resolution Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {staffPerformance.length > 0 ? staffPerformance.map((staff, index) => (
                                    <tr key={staff.staff_id} className={`${index === 0 ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10' : 'hover:bg-slate-800/30'} transition-colors duration-200`}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                            {staff.staff_name}
                                            {index === 0 && <span className="ml-2 text-xs text-yellow-400">🏆</span>}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{staff.incidents_handled}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{staff.avg_response_time} min</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{staff.avg_resolution_time} min</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-8 text-center text-slate-400">
                                            No resolved incidents yet
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
                {/* Status Distribution Chart */}
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-6 shadow-2xl backdrop-blur-sm">
                    <h3 className="text-xl font-bold text-white mb-6">Status Distribution</h3>
                    <div className="space-y-4">
                        {[
                            { status: 'pending', label: 'Pending', count: emergencies.filter(e => e.status === 'pending').length, color: 'bg-yellow-500' },
                            { status: 'accepted', label: 'Accepted', count: emergencies.filter(e => e.status === 'accepted').length, color: 'bg-blue-500' },
                            { status: 'in_progress', label: 'In Progress', count: emergencies.filter(e => e.status === 'in_progress').length, color: 'bg-orange-500' },
                            { status: 'resolved', label: 'Resolved', count: emergencies.filter(e => e.status === 'resolved').length, color: 'bg-emerald-500' }
                        ].map((item) => (
                            <div key={item.status} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full ${item.color}`}></div>
                                    <span className="text-slate-300 font-medium">{item.label}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-24 bg-slate-700 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${item.color} transition-all duration-500`}
                                            style={{ width: `${total > 0 ? (item.count / total) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-white font-bold w-8 text-right">{item.count}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Type Distribution Chart */}
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-6 shadow-2xl backdrop-blur-sm">
                    <h3 className="text-xl font-bold text-white mb-6">Emergency Types</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {Object.entries(emergenciesByType).map(([type, count]) => {
                            const percentage = total > 0 ? Math.round((count / total) * 100) : 0
                            const colors = {
                                'Fire': 'bg-red-500',
                                'Medical': 'bg-red-500',
                                'Security': 'bg-yellow-500',
                                'General': 'bg-green-500'
                            }
                            return (
                                <div key={type} className="bg-slate-950/50 rounded-lg p-4 border border-white/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-slate-300 font-medium">{type}</span>
                                        <span className="text-white font-bold">{count}</span>
                                    </div>
                                    <div className="w-full bg-slate-700 rounded-full h-2 mb-2">
                                        <div
                                            className={`h-2 rounded-full ${colors[type] || 'bg-blue-500'} transition-all duration-500`}
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-slate-400 text-xs">{percentage}% of total</p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Global Map View */}
            <div className="mt-8 rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-6 shadow-2xl backdrop-blur-sm">
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-white">Global Emergency Map</h2>
                    <p className="text-slate-300 text-sm">Real-time emergency locations and response coordination</p>
                </div>
                <EmergencyMap emergencies={emergencies} />
            </div>

            {/* Staff Activity Section */}
            <div className="mt-8 rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-6 shadow-2xl backdrop-blur-sm">
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-white mb-2">Staff Activity</h2>
                    <p className="text-slate-300 text-sm">Current assignments and response status</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {emergencies.filter(e => e.assignedStaffId).slice(0, 6).map((emergency) => {
                        const assignedStaff = staffOptions.find((staff) => staff.uid === emergency.assignedStaffId)
                        return (
                            <div key={emergency.id} className="bg-slate-950/50 rounded-lg p-4 border border-white/5">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                        <span className="text-xs font-bold text-white">👨‍⚕️</span>
                                    </div>
                                    <div>
                                        <p className="text-white font-medium text-sm">Staff Assigned</p>
                                        <p className="text-slate-400 text-xs">{assignedStaff?.fullName || emergency.assignedStaffName || 'Staff member'}</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400">Type:</span>
                                        <span className="text-slate-300">{emergency.title || emergency.emergencyType}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400">Status:</span>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${emergency.status === 'resolved' ? 'text-emerald-300 bg-emerald-500/10' :
                                            emergency.status === 'in_progress' ? 'text-orange-300 bg-orange-500/10' :
                                                'text-blue-300 bg-blue-500/10'
                                            }`}>
                                            {formatEmergencyStatus(emergency.status)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400">Responder Location:</span>
                                        <span className="text-slate-300">{assignedStaff?.currentLocationLabel || 'Unknown'}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    {emergencies.filter(e => e.assignedStaffId).length === 0 && (
                        <div className="col-span-full text-center py-8">
                            <div className="text-4xl mb-4">👥</div>
                            <p className="text-slate-300">No active staff assignments</p>
                            <p className="text-slate-400 text-sm">Staff will be assigned as emergencies come in</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Controls and Emergency Management */}
            <div className="mt-8 flex items-center justify-between">
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => setFilter('all')}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 hover:scale-105 ${filter === 'all'
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                            : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-white/10 hover:border-white/20'
                            }`}
                    >
                        All Cases
                    </button>
                    <button
                        onClick={() => setFilter('pending')}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 hover:scale-105 ${filter === 'pending'
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white shadow-lg shadow-yellow-500/30'
                            : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-white/10 hover:border-white/20'
                            }`}
                    >
                        Pending
                    </button>
                    <button
                        onClick={() => setFilter('in_progress')}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 hover:scale-105 ${filter === 'in_progress'
                            ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/30'
                            : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-white/10 hover:border-white/20'
                            }`}
                    >
                        In Progress
                    </button>
                    <button
                        onClick={() => setFilter('resolved')}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 hover:scale-105 ${filter === 'resolved'
                            ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30'
                            : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-white/10 hover:border-white/20'
                            }`}
                    >
                        Resolved
                    </button>
                </div>
                <button
                    onClick={createDemoEmergency}
                    className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/30 transition-all duration-300 hover:scale-105 hover:shadow-purple-500/50"
                >
                    🎭 Demo Mode
                </button>
            </div>

            {error && <p className="mt-6 rounded-3xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

            {/* Emergency Cards Grid */}
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredEmergencies.length === 0 ? (
                    <div className="col-span-full rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-12 text-center shadow-2xl backdrop-blur-sm">
                        <div className="text-6xl mb-4">🎉</div>
                        <p className="text-slate-300 text-xl font-semibold">No emergencies match the filter</p>
                        <p className="text-slate-400 text-sm mt-2">Try changing the filter or check back later!</p>
                    </div>
                ) : (
                    filteredEmergencies.map((emergency) => (
                        <div
                            key={emergency.id}
                            className={`group relative overflow-hidden rounded-2xl p-6 shadow-xl backdrop-blur-sm border transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${emergency.is_critical
                                    ? 'bg-gradient-to-br from-red-900/80 to-red-800/80 border-red-500/50 shadow-red-500/20 hover:shadow-red-500/30 animate-pulse'
                                    : 'bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-white/10 hover:border-white/20 hover:shadow-cyan-500/10'
                                }`}
                        >
                            {/* Critical Alert Banner */}
                            {emergency.is_critical && (
                                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-red-600 to-red-700 text-white text-center py-1 text-xs font-bold">
                                    ⚠️ CRITICAL INCIDENT - IMMEDIATE ATTENTION REQUIRED
                                </div>
                            )}

                            {/* Priority Indicator */}
                            <div className={`absolute top-4 right-4 ${emergency.is_critical ? 'top-8' : ''}`}>
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${getPriority(emergency) === 'Critical'
                                    ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30'
                                    : getPriority(emergency) === 'High'
                                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                                        : getPriority(emergency) === 'Medium'
                                            ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-lg shadow-yellow-500/30'
                                            : 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30'
                                    }`}>
                                    {getPriority(emergency)}
                                </span>
                            </div>

                            {/* Emergency Details */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors duration-300">
                                        {emergency.title || emergency.emergencyType || 'Emergency'}
                                    </h3>
                                    <p className="text-sm text-slate-400 mt-1">
                                        {emergency.description || 'No description provided'}
                                    </p>
                                </div>

                                {/* Location & Time */}
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                        </svg>
                                        <span>{emergency.locationLabel || emergency.location || 'Location not specified'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                        </svg>
                                        <span>{getResponseTime(emergency.createdAt)}</span>
                                    </div>
                                </div>

                                {/* User & Assignment */}
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                        </svg>
                                        <span>{emergency.userName || emergency.userId || 'Anonymous'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>{emergency.assignedStaffName || 'Unassigned'}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm mt-3 text-slate-400">
                                    <div>
                                        <span className="block">Type</span>
                                        <span className="text-slate-300 font-medium">{emergency.type || emergency.emergencyType || 'general'}</span>
                                    </div>
                                    <div>
                                        <span className="block">Priority</span>
                                        <span className={`font-medium ${emergency.priority === 'high' ? 'text-red-300' : emergency.priority === 'low' ? 'text-emerald-300' : 'text-yellow-300'}`}>
                                            {emergency.priority || 'medium'}
                                        </span>
                                    </div>
                                </div>
                                {emergency.summary && emergency.summary !== emergency.description && (
                                    <p className="mt-3 text-slate-300 text-sm">{emergency.summary}</p>
                                )}
                                <div className="flex items-center justify-between text-sm mt-2">
                                    <span className="text-slate-400">Escalation:</span>
                                    <span className="text-slate-300 font-medium">{emergency.escalation_level ?? 0}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm mt-2">
                                    <span className="text-slate-400">SLA Risk</span>
                                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${emergency.risk_flag
                                        ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                                        : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                        }`}>
                                        {emergency.risk_flag ? 'At Risk' : 'On Track'}
                                    </span>
                                </div>
                                {(emergency.events || []).length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-white/5">
                                        <p className="text-xs font-semibold text-slate-300 mb-2">Timeline</p>
                                        <div className="space-y-1">
                                            {(emergency.events || []).map((event, idx) => (
                                                <div key={idx} className="flex items-start gap-2 text-xs text-slate-400">
                                                    <span className="text-sm">{getEventIcon(event.event_type)}</span>
                                                    <div className="flex-1">
                                                        <span className="text-slate-300 font-medium">{formatEventType(event.event_type)}</span>
                                                        <span className="text-slate-500 text-[11px]"> • {formatEventTimestamp(event.timestamp)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {!emergency.assignedStaffId && staffOptions.length > 0 && (
                                    <div className="flex gap-2">
                                        <select
                                            value={assignmentSelections[emergency.id] || ''}
                                            onChange={(event) => setAssignmentSelections((prev) => ({ ...prev, [emergency.id]: event.target.value }))}
                                            className="flex-1 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                                        >
                                            <option value="">Select staff</option>
                                            {staffOptions.map((staffUser) => (
                                                <option key={staffUser.uid} value={staffUser.uid}>
                                                    {staffUser.fullName || staffUser.email || staffUser.uid}
                                                    {staffUser.currentLocationLabel ? ` (${staffUser.currentLocationLabel})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => handleAssignEmergency(emergency)}
                                            className="rounded-lg bg-gradient-to-r from-indigo-500 to-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:scale-105"
                                        >
                                            Assign
                                        </button>
                                    </div>
                                )}

                                {/* Status & Actions */}
                                <div className="flex items-center justify-between">
                                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${emergency.status === 'pending'
                                        ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-300 border border-yellow-500/30'
                                        : emergency.status === 'escalated'
                                            ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 border border-orange-500/30'
                                            : emergency.status === 'critical'
                                                ? 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-300 border border-red-500/30'
                                                : emergency.status === 'in_progress'
                                                    ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 border border-orange-500/30'
                                                    : emergency.status === 'resolved'
                                                        ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-300 border border-emerald-500/30'
                                                        : 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 border border-blue-500/30'
                                        }`}>
                                        {formatEmergencyStatus(emergency.status)}
                                    </span>
                                    <div className="flex gap-2">
                                        {emergency.status !== 'resolved' && (
                                            <button
                                                onClick={() => handleUpdateStatus(emergency.id, emergency.status === 'accepted' ? 'in_progress' : 'resolved')}
                                                className="rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-105 hover:shadow-blue-500/50"
                                            >
                                                {emergency.status === 'accepted' ? 'Start' : 'Resolve'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Timeline */}
                                <div className="mt-4">
                                    {(emergency.recommendations || []).length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-xs font-semibold text-slate-300 mb-2">Recommended Actions</p>
                                            <div className="space-y-1">
                                                {(emergency.recommendations || []).map((recommendation, idx) => (
                                                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-400">
                                                        <span className="text-sm">📋</span>
                                                        <span className="text-slate-300">{recommendation}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <StatusTimeline status={emergency.status} />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    )
}

export default AdminDashboard


