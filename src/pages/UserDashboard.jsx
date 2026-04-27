import { useState, useEffect } from 'react'
import { useBrowserNotifications } from '../hooks/useBrowserNotifications'

import { useNavigate } from 'react-router-dom'
import { useUser } from '../UserContext.jsx'
import Toast from '../components/Toast.jsx'
import OfflineIndicator from '../components/OfflineIndicator.jsx'
import RetryButton from '../components/RetryButton.jsx'
import Spinner from '../components/Spinner.jsx'
import StatusTimeline from '../components/StatusTimeline.jsx'
import { LiveUpdateIndicator, RealtimeToast } from '../components/RealtimeIndicator.jsx'
import {
    formatEmergencyStatus,
    getPriority,
    getPriorityColor,
    getResponseTime,
    normalizeOrganizationId,
    safeGetTimestamp
} from '../utils/emergencyUtils.js'
import { createEmergency, fetchEmergencies, getQueuedIncidentCount, syncQueuedIncidents } from '../utils/emergencyService.js'
import { generateIncidentPDF } from '../utils/pdfService.js'
import { getSafeErrorMessage, logErrorSafely } from '../utils/errorHandler.js'
import { socketService } from '../utils/socketService.js'

function UserDashboard() {
    console.log('UserDashboard component called')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [latestEmergency, setLatestEmergency] = useState(null)
    const [emergencies, setEmergencies] = useState([])
    const [selectedFilter, setSelectedFilter] = useState('all')
    const [exportingPdfId, setExportingPdfId] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [queuedOfflineCount, setQueuedOfflineCount] = useState(0)
    const [retryingQueued, setRetryingQueued] = useState(false)
    const [sortOption, setSortOption] = useState('latest')
    const [incidentTitle, setIncidentTitle] = useState('')
    const [description, setDescription] = useState('')
    const [incidentBuilding, setIncidentBuilding] = useState('')
    const [incidentFloor, setIncidentFloor] = useState('')
    const [incidentRoom, setIncidentRoom] = useState('')
    const [stableOrgId, setStableOrgId] = useState(null)
    const [realtimeToast, setRealtimeToast] = useState(null)
    const { user, userData, loading: authLoading } = useUser()
    const { requestPermission } = useBrowserNotifications()
    const navigate = useNavigate()
    const [toast, setToast] = useState(null)
    const normalizedOrgId = normalizeOrganizationId(userData?.organizationId || '')

    useEffect(() => {
        console.log('Rendering dashboard')
        console.log('User:', user)
        console.log('Location:', userData?.current_location)
    }, [user, userData])

    useEffect(() => {
        // Request browser notification permission
        requestPermission();
    }, [requestPermission]);

    useEffect(() => {
        if (normalizedOrgId && normalizedOrgId !== stableOrgId) {
            setStableOrgId(normalizedOrgId)
        }

        if (!normalizedOrgId && stableOrgId) {
            setStableOrgId(null)
        }
    }, [normalizedOrgId, stableOrgId])

    useEffect(() => {
        setQueuedOfflineCount(getQueuedIncidentCount())

        const handleOnline = async () => {
            try {
                const result = await syncQueuedIncidents()
                setQueuedOfflineCount(getQueuedIncidentCount())
                if (result.synced > 0) {
                    setToast({ message: `Retried ${result.synced} queued alert(s)`, type: 'success' })
                }
            } catch (error) {
                logErrorSafely('syncQueuedIncidents', error)
            }
        }

        if (navigator.onLine) {
            handleOnline()
        }

        window.addEventListener('online', handleOnline)
        return () => window.removeEventListener('online', handleOnline)
    }, [])

    useEffect(() => {
        // Request browser notification permission
        requestPermission();
    }, [requestPermission]);

    useEffect(() => {
        if (!authLoading && user && !normalizedOrgId) {
            console.log('User Dashboard: No organization setup, redirecting')
            navigate('/organization-setup')
        }
    }, [authLoading, user, normalizedOrgId, navigate])

    useEffect(() => {
        // Request browser notification permission
        requestPermission();
    }, [requestPermission]);

    useEffect(() => {
        if (authLoading || !stableOrgId || !user?.uid || !userData) {
            console.log('User Dashboard: Waiting for stable orgId + auth + userData', {
                stableOrgId,
                userId: user?.uid,
                userData: userData ? 'loaded' : 'missing'
            })
            return
        }

        console.log('Using stable orgId:', stableOrgId)

        console.log('User Dashboard: Setting up query for user emergencies', {
            userId: user.uid,
            stableOrgId,
            userDataOrgId: userData?.organizationId
        })

        try {
            const unsubscribe = fetchEmergencies({
                organizationId: stableOrgId,
                userId: user.uid,
                onNext: (emergencies) => {
                    console.log('User Dashboard: Received emergencies', {
                        count: (emergencies || []).length,
                        userId: user.uid,
                        stableOrgId,
                        emergencies: emergencies
                    })
                    setEmergencies(emergencies || [])
                    setLatestEmergency((emergencies || [])[0] || null)
                },
                onError: (error) => {
                    console.error('User Dashboard: Firestore listener error:', error.message, { code: error.code })
                    setError(`Unable to load your emergencies: ${error.message}`)
                }
            })

            return unsubscribe
        } catch (err) {
            console.error('User Dashboard: Query setup error:', err.message)
            setError(`Query error: ${err.message}`)
        }
    }, [authLoading, stableOrgId, user?.uid, userData])

    // Initialize socket connection and listen for real-time updates
    useEffect(() => {
        if (!stableOrgId || !user?.uid) return

        const setupSocket = async () => {
            try {
                // Connect to socket server
                await socketService.connect(
                    import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'
                )

                // Join organization room
                socketService.joinOrganization(stableOrgId, user.uid, userData?.role || 'user')

                // Listen for new incidents
                socketService.onIncidentCreated((incident) => {
                    console.log('📋 Real-time: New incident', incident)
                    setRealtimeToast({
                        message: `New Incident: ${incident.title}`,
                        type: 'info'
                    })
                    // Firestore listener will automatically update the list
                })

                // Listen for incident updates
                socketService.onIncidentUpdated((incident) => {
                    console.log('✏️ Real-time: Incident updated', incident)
                    setRealtimeToast({
                        message: `Status Updated: ${incident.status}`,
                        type: 'success'
                    })
                })

                // Listen for escalations
                socketService.onIncidentEscalated((escalation) => {
                    console.log('🚨 Real-time: Incident escalated', escalation)
                    setRealtimeToast({
                        message: `⚠️ Critical: ${escalation.title}`,
                        type: 'warning'
                    })
                })

            } catch (error) {
                console.warn('Socket connection failed, using fallback:', error)
                // Firestore listeners will continue to work as fallback
            }
        }

        setupSocket()

        return () => {
            socketService.disconnect()
        }
    }, [stableOrgId, user?.uid, userData?.role])

    const getFilteredAndSortedEmergencies = () => {
        let filtered = (emergencies || []).filter((emergency) => {
            const matchesStatus = selectedFilter === 'all' || emergency.status === selectedFilter
            const matchesSearch = searchTerm === '' ||
                emergency.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                emergency.description?.toLowerCase().includes(searchTerm.toLowerCase())
            return matchesStatus && matchesSearch
        })

        if (sortOption === 'oldest') {
            filtered = filtered.sort((a, b) => safeGetTimestamp(a.createdAt) - safeGetTimestamp(b.createdAt))
        } else if (sortOption === 'latest') {
            filtered = filtered.sort((a, b) => safeGetTimestamp(b.createdAt) - safeGetTimestamp(a.createdAt))
        } else if (sortOption === 'status-priority') {
            const statusOrder = { pending: 1, accepted: 2, in_progress: 3, resolved: 4 }
            filtered = filtered.sort((a, b) => {
                const aOrder = statusOrder[a.status] || 5
                const bOrder = statusOrder[b.status] || 5
                if (aOrder !== bOrder) return aOrder - bOrder
                return safeGetTimestamp(b.createdAt) - safeGetTimestamp(a.createdAt)
            })
        }

        return filtered
    }

    // Calculate stats for user dashboard
    const totalEmergencies = (emergencies || []).length
    const activeEmergencies = (emergencies || []).filter((e) => e.status !== 'resolved').length
    const resolvedEmergencies = (emergencies || []).filter((e) => e.status === 'resolved').length

    const handleEmergency = () => {
        console.log('User Dashboard: handleEmergency called', {
            user: user ? { uid: user.uid } : null,
            userData: userData ? { organizationId: userData.organizationId } : null,
            authLoading
        })

        setMessage('')
        setError('')

        if (!user) {
            setError('Please log in before sending an emergency.')
            return
        }

        if (!userData) {
            setError('User profile not loaded. Please try refreshing the page.')
            return
        }

        if (!userData.organizationId) {
            setError('Organization not set. Please complete organization setup first.')
            return
        }

        if (!navigator.geolocation) {
            setError('Geolocation is not available in this browser.')
            return
        }

        if (!incidentTitle.trim()) {
            setError('Please provide an incident title.')
            return
        }

        if (!description.trim()) {
            setError('Please provide an incident description.')
            return
        }

        setLoading(true)
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords
                    await createEmergency({
                        user: {
                            uid: user.uid,
                            organizationId: userData.organizationId,
                            organizationName: userData.organizationName || 'Unknown Organization',
                            fullName: userData.fullName || user.displayName || 'Unknown',
                            phone: userData.phone || '',
                            email: user.email || ''
                        },
                        title: incidentTitle,
                        description,
                        latitude,
                        longitude,
                        location: {
                            building: incidentBuilding,
                            floor: incidentFloor,
                            room: incidentRoom
                        }
                    })

                    console.log('User Dashboard: Emergency created successfully', {
                        userId: user.uid,
                        organizationId: userData.organizationId,
                        title: incidentTitle,
                        latitude,
                        longitude
                    })

                    setToast({ message: 'Incident created successfully!', type: 'success' })
                    setDescription('')
                    setIncidentTitle('')
                    setIncidentBuilding('')
                    setIncidentFloor('')
                    setIncidentRoom('')
                } catch (saveError) {
                    logErrorSafely('createEmergency', saveError)

                    if (saveError.code === 'RATE_LIMITED') {
                        setError(`Too many incidents created. Please wait ${saveError.retryAfter} seconds before trying again.`)
                    } else if (saveError.code === 'VALIDATION_ERROR') {
                        const errors = saveError.details || {}
                        const errorList = Object.values(errors).join(', ')
                        setError(`Invalid input: ${errorList}`)
                    } else if (saveError.code === 'OFFLINE_QUEUED') {
                        setToast({ message: 'Offline alert queued successfully and will retry when online.', type: 'info' })
                        setQueuedOfflineCount(getQueuedIncidentCount())
                    } else {
                        setError(getSafeErrorMessage(saveError))
                    }
                } finally {
                    setLoading(false)
                }
            },
            () => {
                setError('Location permission is required to send an alert.')
                setLoading(false)
            },
            { enableHighAccuracy: true }
        )
    }

    if (authLoading) {
        console.log('User Dashboard: Auth loading, showing spinner')
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <div className="text-center">
                    <Spinner />
                    <p className="mt-4 text-slate-300">Loading your dashboard...</p>
                </div>
            </div>
        )
    }

    console.log('User Dashboard: Rendering main dashboard', {
        user: user ? 'present' : 'missing',
        userData: userData ? 'present' : 'missing',
        stableOrgId,
        incidentBuilding,
        incidentFloor,
        authLoading,
        userDataKeys: userData ? Object.keys(userData) : 'no userData'
    })

    console.log('User Dashboard: About to render component')

    try {
        return (
            <div className="mx-auto max-w-6xl px-6 py-10 text-slate-100">
                {console.log('User Dashboard: Rendering JSX')}
                {/* Real-time Toast Notifications */}
                {realtimeToast && (
                    <div className="fixed top-4 right-4 z-50">
                        <RealtimeToast
                            message={realtimeToast.message}
                            type={realtimeToast.type}
                            onClose={() => setRealtimeToast(null)}
                        />
                    </div>
                )}

                {/* Enhanced Header */}
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 shadow-2xl backdrop-blur-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                    <span className="text-xl font-bold text-white">{userData?.fullName?.charAt(0)?.toUpperCase() || user?.displayName?.charAt(0)?.toUpperCase() || 'U'}</span>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-white bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                                        Welcome back, {userData?.fullName?.split(' ')[0] || user?.displayName?.split(' ')[0] || 'User'}
                                    </h1>
                                    <p className="text-slate-300 text-lg">{userData?.organizationName || "Organization doesn't exist"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <p className="text-sm text-slate-400">Emergency Response Dashboard • {userData?.role || 'user'}</p>
                                <LiveUpdateIndicator />
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/organization-setup')}
                            className="rounded-xl bg-slate-700/50 px-4 py-2 text-sm font-semibold text-slate-300 transition-all duration-300 hover:scale-105 hover:bg-slate-600/50 border border-white/10 hover:border-white/20"
                        >
                            Change Organization
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        <div className="text-4xl font-bold text-white mb-2">{totalEmergencies}</div>
                        <p className="text-slate-300 font-medium">Total Emergencies</p>
                        <div className="mt-3 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"></div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        <div className="text-4xl font-bold text-orange-400 mb-2">{activeEmergencies}</div>
                        <p className="text-slate-300 font-medium">Active Cases</p>
                        <div className="mt-3 h-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                        <div className="text-4xl font-bold text-emerald-400 mb-2">{resolvedEmergencies}</div>
                        <p className="text-slate-300 font-medium">Resolved</p>
                        <div className="mt-3 h-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full"></div>
                    </div>
                </div>

                {queuedOfflineCount > 0 && (
                    <div className="mt-8 rounded-3xl border border-emerald-500/20 bg-slate-950/90 p-4 text-slate-100 shadow-lg">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold text-emerald-300">Offline alerts queued</p>
                                <p className="text-sm text-slate-300">{queuedOfflineCount} incident request(s) are waiting to retry when connection returns.</p>
                            </div>
                            <RetryButton
                                onClick={async () => {
                                    setRetryingQueued(true)
                                    try {
                                        const result = await syncQueuedIncidents()
                                        setQueuedOfflineCount(getQueuedIncidentCount())
                                        if (result.synced > 0) {
                                            setToast({ message: `Retried ${result.synced} queued alert(s)`, type: 'success' })
                                        }
                                        if (result.remaining > 0) {
                                            setToast({ message: `${result.remaining} queued alert(s) remain`, type: 'warning' })
                                        }
                                    } catch (retryError) {
                                        logErrorSafely('retryQueuedIncidents', retryError)
                                        setToast({ message: 'Failed to retry queued alerts', type: 'error' })
                                    } finally {
                                        setRetryingQueued(false)
                                    }
                                }}
                                loading={retryingQueued}
                                disabled={retryingQueued}
                                label="Retry Offline Alerts"
                                count={queuedOfflineCount}
                            />
                        </div>
                    </div>
                )}

                {/* Emergency Reporting Card */}
                <div className="mt-8 rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 shadow-2xl backdrop-blur-sm">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-white mb-2">Report Emergency</h2>
                        <p className="text-slate-300">Get immediate assistance when you need it most</p>
                    </div>
                    <div className="mt-6 space-y-6">
                        {console.log('User Dashboard: Rendering form inputs', { incidentBuilding, incidentFloor })}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-semibold text-slate-200 mb-2">Incident Title</label>
                                <input
                                    type="text"
                                    value={incidentTitle}
                                    onChange={(e) => setIncidentTitle(e.target.value)}
                                    placeholder="Short incident title..."
                                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 placeholder-slate-400 transition-all duration-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-200 mb-2">Description</label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Brief description of the emergency..."
                                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 placeholder-slate-400 transition-all duration-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3 mt-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-200 mb-2">Building</label>
                                <input
                                    type="text"
                                    value={incidentBuilding}
                                    onChange={(e) => setIncidentBuilding(e.target.value)}
                                    placeholder="Block A"
                                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 placeholder-slate-400 transition-all duration-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-200 mb-2">Floor</label>
                                <input
                                    type="text"
                                    value={incidentFloor}
                                    onChange={(e) => setIncidentFloor(e.target.value)}
                                    placeholder="3"
                                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 placeholder-slate-400 transition-all duration-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-200 mb-2">Room Number</label>
                                <input
                                    type="text"
                                    value={incidentRoom}
                                    onChange={(e) => setIncidentRoom(e.target.value)}
                                    placeholder="305"
                                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 placeholder-slate-400 transition-all duration-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                                />
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleEmergency}
                        disabled={loading}
                        className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-8 py-6 text-xl font-bold text-white shadow-2xl shadow-red-500/30 transition-all duration-300 hover:scale-105 hover:shadow-red-500/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 animate-pulse hover:animate-none"
                    >
                        {loading ? (
                            <div className="flex items-center gap-3">
                                <Spinner size="md" />
                                <span>Sending Emergency Alert...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🚨</span>
                                <span>EMERGENCY</span>
                                <span className="text-2xl">🚨</span>
                            </div>
                        )}
                    </button>
                    {message && <p className="mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-200">{message}</p>}
                    {error && <p className="mt-4 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-200">{error}</p>}
                    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                </div>

                {/* Emergency History */}
                <div className="mt-8 rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 shadow-2xl backdrop-blur-sm">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-white mb-2">Emergency History</h2>
                        <p className="text-slate-300">Track and manage your emergency reports</p>
                    </div>

                    <div className="mb-6 space-y-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex-1 max-w-md">
                                <label className="block text-sm font-semibold text-slate-200 mb-2">Search Emergencies</label>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search by type or description..."
                                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 placeholder-slate-400 transition-all duration-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                                />
                            </div>
                            <div className="sm:w-48">
                                <label className="block text-sm font-semibold text-slate-200 mb-2">Sort By</label>
                                <select
                                    value={sortOption}
                                    onChange={(e) => setSortOption(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 transition-all duration-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                                >
                                    <option value="latest">Latest</option>
                                    <option value="oldest">Oldest</option>
                                    <option value="status-priority">Status Priority</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {['all', 'pending', 'accepted', 'in_progress', 'resolved'].map((status) => (
                                <button
                                    key={status}
                                    type="button"
                                    onClick={() => setSelectedFilter(status)}
                                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-105 ${selectedFilter === status
                                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                                        : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    {status === 'all' ? 'All' : formatEmergencyStatus(status)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {getFilteredAndSortedEmergencies().length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-slate-950/80 p-12 text-center transition-all duration-300 hover:-translate-y-1">
                            <div className="text-6xl mb-4">🔍</div>
                            <p className="text-slate-300 text-xl font-medium">No matching emergencies</p>
                            <p className="text-slate-400 text-sm mt-2">Try adjusting your search or filters.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {getFilteredAndSortedEmergencies().map((emergency) => {
                                console.log('User Dashboard: Rendering emergency item', {
                                    id: emergency.id,
                                    status: emergency.status,
                                    emergencyType: emergency.emergencyType,
                                    createdAt: emergency.createdAt
                                })

                                const statusColors = {
                                    pending: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
                                    accepted: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
                                    in_progress: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
                                    resolved: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                                }
                                const incidentTitle = emergency.title || emergency.emergencyType || 'Untitled Incident'
                                return (
                                    <div key={emergency.id} className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-950/80 to-slate-900/80 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className={`w-3 h-3 rounded-full ${emergency.emergencyType === 'Fire' ? 'bg-red-500' :
                                                        emergency.emergencyType === 'Medical' ? 'bg-red-500' :
                                                            emergency.emergencyType === 'Security' ? 'bg-yellow-500' : 'bg-green-500'
                                                        }`}></div>
                                                    <p className="text-lg font-bold text-white">{incidentTitle}</p>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(getPriority(emergency.emergencyType || incidentTitle))}`}>
                                                        {getPriority(emergency.emergencyType || incidentTitle)}
                                                    </span>
                                                </div>
                                                <p className="text-slate-400 text-sm mb-3">{emergency.description || 'No description provided'}</p>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-slate-500">Location</p>
                                                        <p className="text-slate-300 font-medium">{emergency.latitude?.toFixed(3) ?? 'N/A'}, {emergency.longitude?.toFixed(3) ?? 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-500">Reported</p>
                                                        <p className="text-slate-300 font-medium">{emergency.createdAt ? new Date(safeGetTimestamp(emergency.createdAt)).toLocaleString() : 'Unknown'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-3">
                                                <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${statusColors[emergency.status] || 'text-slate-300 border-slate-600'}`}>
                                                    {formatEmergencyStatus(emergency.status || 'pending')}
                                                </span>
                                                <div className="text-right">
                                                    <p className="text-slate-500 text-xs">Response Time</p>
                                                    <p className="text-slate-300 text-sm font-medium">{getResponseTime(emergency.createdAt)}</p>
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

                {latestEmergency && (
                    <div className="mt-8 rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 shadow-2xl backdrop-blur-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-1">Latest Emergency Status</h2>
                                <p className="text-slate-300">Real-time updates on your most recent report</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <span className={`px-4 py-2 rounded-full text-sm font-bold border-2 ${latestEmergency.status === 'resolved'
                                    ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                                    : latestEmergency.status === 'in_progress'
                                        ? 'text-orange-300 bg-orange-500/10 border-orange-500/30'
                                        : 'text-blue-300 bg-blue-500/10 border-blue-500/30'
                                    }`}>
                                    {latestEmergency.status === 'resolved'
                                        ? 'Resolved'
                                        : latestEmergency.status === 'in_progress'
                                            ? 'In Progress'
                                            : 'Help is on the way'}
                                </span>
                                <button
                                    onClick={() => handleDownloadPDF(latestEmergency)}
                                    disabled={exportingPdfId === latestEmergency.id}
                                    className={`rounded-xl px-4 py-2 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:scale-105 ${exportingPdfId === latestEmergency.id
                                        ? 'bg-slate-500/70 cursor-not-allowed shadow-slate-500/20'
                                        : 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/30 hover:shadow-emerald-500/50'
                                        }`}
                                >
                                    {exportingPdfId === latestEmergency.id ? 'Generating PDF...' : 'Download PDF'}
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2 mb-6">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full ${latestEmergency.emergencyType === 'Fire' ? 'bg-red-500' :
                                        latestEmergency.emergencyType === 'Medical' ? 'bg-red-500' :
                                            latestEmergency.emergencyType === 'Security' ? 'bg-yellow-500' : 'bg-green-500'
                                        }`}></div>
                                    <div>
                                        <p className="text-white font-bold text-lg">{latestEmergency.title || latestEmergency.emergencyType || 'Untitled Incident'}</p>
                                        <span className={`ml-2 px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(getPriority(latestEmergency.emergencyType || latestEmergency.title))}`}>
                                            {getPriority(latestEmergency.emergencyType || latestEmergency.title)} Priority
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Response Time:</span>
                                        <span className="text-white font-medium">{getResponseTime(latestEmergency.createdAt)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Assigned Staff:</span>
                                        <span className="text-white font-medium">{latestEmergency.assignedStaffName || 'Not yet assigned'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Location:</span>
                                        <span className="text-white font-medium">{latestEmergency.latitude?.toFixed(4) ?? 'N/A'}, {latestEmergency.longitude?.toFixed(4) ?? 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Reported:</span>
                                        <span className="text-white font-medium">{new Date(safeGetTimestamp(latestEmergency.createdAt)).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-center">
                                <div className="w-full max-w-xs">
                                    <StatusTimeline status={latestEmergency.status} />
                                </div>
                            </div>
                        </div>

                        {latestEmergency.status !== 'resolved' && (
                            <div className="rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 p-4">
                                <div className="flex items-center gap-3">
                                    <div className="text-2xl">🚑</div>
                                    <div>
                                        <p className="text-blue-300 font-bold">Emergency responders are on their way</p>
                                        <p className="text-blue-400 text-sm">Stay calm and follow any instructions from authorities. Help is coming.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    } catch (renderError) {
        console.error('User Dashboard: Render error', renderError)
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <div className="text-center">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h2 className="text-xl font-bold text-white mb-2">Render Error</h2>
                    <p className="text-slate-300 mb-4">There was an error rendering the dashboard.</p>
                    <p className="text-red-400 text-sm">{renderError.message}</p>
                </div>
            </div>
        )
    }
}

export default UserDashboard








