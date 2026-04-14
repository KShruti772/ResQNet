import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDoc, collection, onSnapshot, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { useUser } from '../UserContext.jsx'
import Toast from '../components/Toast.jsx'
import Spinner from '../components/Spinner.jsx'
import StatusTimeline from '../components/StatusTimeline.jsx'
import { getPriority, getPriorityColor, getResponseTime } from '../utils/emergencyUtils.js'

function UserDashboard() {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [latestEmergency, setLatestEmergency] = useState(null)
    const [emergencies, setEmergencies] = useState([])
    const [selectedFilter, setSelectedFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [sortOption, setSortOption] = useState('latest')
    const [emergencyType, setEmergencyType] = useState('General')
    const [description, setDescription] = useState('')
    const { user } = useUser()
    const navigate = useNavigate()
    const [toast, setToast] = useState(null)

    useEffect(() => {
        if (user && !user.organizationId) {
            navigate('/organization-setup')
        }
    }, [user, navigate])

    useEffect(() => {
        if (!user?.organizationId) return

        const q = query(
            collection(db, 'emergencies'),
            where('userId', '==', user.uid),
            where('organizationId', '==', user.organizationId),
            orderBy('createdAt', 'desc')
        )

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }))
            setEmergencies(fetched)
            setLatestEmergency(fetched[0] || null)
        })

        return unsubscribe
    }, [user])

    const getFilteredAndSortedEmergencies = () => {
        let filtered = emergencies.filter((emergency) => {
            const matchesStatus = selectedFilter === 'all' || emergency.status === selectedFilter
            const matchesSearch = searchTerm === '' ||
                emergency.emergencyType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                emergency.description?.toLowerCase().includes(searchTerm.toLowerCase())
            return matchesStatus && matchesSearch
        })

        if (sortOption === 'oldest') {
            filtered = filtered.sort((a, b) => new Date(a.createdAt.seconds * 1000) - new Date(b.createdAt.seconds * 1000))
        } else if (sortOption === 'latest') {
            filtered = filtered.sort((a, b) => new Date(b.createdAt.seconds * 1000) - new Date(a.createdAt.seconds * 1000))
        } else if (sortOption === 'status-priority') {
            const statusOrder = { pending: 1, accepted: 2, 'in progress': 3, resolved: 4 }
            filtered = filtered.sort((a, b) => {
                const aOrder = statusOrder[a.status] || 5
                const bOrder = statusOrder[b.status] || 5
                if (aOrder !== bOrder) return aOrder - bOrder
                return new Date(b.createdAt.seconds * 1000) - new Date(a.createdAt.seconds * 1000)
            })
        }

        return filtered
    }

    // Calculate stats for user dashboard
    const totalEmergencies = emergencies.length
    const activeEmergencies = emergencies.filter((e) => e.status !== 'resolved').length
    const resolvedEmergencies = emergencies.filter((e) => e.status === 'resolved').length

    const handleEmergency = () => {
        setMessage('')
        setError('')

        if (!user) {
            setError('Please log in before sending an emergency.')
            return
        }
        if (!navigator.geolocation) {
            setError('Geolocation is not available in this browser.')
            return
        }

        setLoading(true)
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords
                    const userRef = doc(db, 'users', user.uid)
                    const userSnap = await getDoc(userRef)
                    const userData = userSnap.data()
                    await addDoc(collection(db, 'emergencies'), {
                        userId: user.uid,
                        userName: userData.fullName,
                        phone: userData.phone,
                        emergencyType: emergencyType,
                        description: description,
                        latitude,
                        longitude,
                        status: 'pending',
                        assignedTo: null,
                        organizationId: user.organizationId,
                        createdAt: new Date(),
                    })
                    setToast({ message: '🚨 Emergency reported successfully!', type: 'success' })
                } catch (saveError) {
                    setError('Failed to send emergency. Please try again.')
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

    return (
        <div className="mx-auto max-w-6xl px-6 py-10 text-slate-100">
            {/* Enhanced Header */}
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 shadow-2xl backdrop-blur-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                <span className="text-xl font-bold text-white">{user?.fullName?.charAt(0)?.toUpperCase() || 'U'}</span>
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                                    Welcome back, {user?.fullName?.split(' ')[0] || 'User'}
                                </h1>
                                <p className="text-slate-300 text-lg">{user?.organizationName || 'Organization'}</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400">Emergency Response Dashboard • {user?.role || 'user'}</p>
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
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
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

            {/* Emergency Reporting Card */}
            <div className="mt-8 rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-8 shadow-2xl backdrop-blur-sm">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">Report Emergency</h2>
                    <p className="text-slate-300">Get immediate assistance when you need it most</p>
                </div>
                <div className="mt-6 space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-sm font-semibold text-slate-200 mb-2">Emergency Type</label>
                            <select
                                value={emergencyType}
                                onChange={(e) => setEmergencyType(e.target.value)}
                                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 transition-all duration-200 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                            >
                                <option>Fire</option>
                                <option>Medical</option>
                                <option>Security</option>
                                <option>General</option>
                            </select>
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
                        {['all', 'pending', 'accepted', 'in progress', 'resolved'].map((status) => (
                            <button
                                key={status}
                                type="button"
                                onClick={() => setSelectedFilter(status)}
                                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-105 ${
                                    selectedFilter === status 
                                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30' 
                                        : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-white/10 hover:border-white/20'
                                }`}
                            >
                                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
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
                            const statusColors = {
                                pending: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
                                accepted: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
                                'in progress': 'text-orange-300 bg-orange-500/10 border-orange-500/20',
                                resolved: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                            }
                            return (
                                <div key={emergency.id} className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-950/80 to-slate-900/80 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={`w-3 h-3 rounded-full ${
                                                    emergency.emergencyType === 'Fire' ? 'bg-red-500' :
                                                    emergency.emergencyType === 'Medical' ? 'bg-red-500' :
                                                    emergency.emergencyType === 'Security' ? 'bg-yellow-500' : 'bg-green-500'
                                                }`}></div>
                                                <p className="text-lg font-bold text-white">{emergency.emergencyType || 'General'}</p>
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(getPriority(emergency.emergencyType))}`}>
                                                    {getPriority(emergency.emergencyType)}
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
                                                    <p className="text-slate-300 font-medium">{emergency.createdAt ? new Date(emergency.createdAt.seconds * 1000).toLocaleString() : 'Unknown'}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-3">
                                            <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${statusColors[emergency.status] || 'text-slate-300 border-slate-600'}`}>
                                                {emergency.status || 'pending'}
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
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">Latest Emergency Status</h2>
                            <p className="text-slate-300">Real-time updates on your most recent report</p>
                        </div>
                        <span className={`px-4 py-2 rounded-full text-sm font-bold border-2 ${
                            latestEmergency.status === 'resolved' 
                                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' 
                                : latestEmergency.status === 'in progress' 
                                ? 'text-orange-300 bg-orange-500/10 border-orange-500/30' 
                                : 'text-blue-300 bg-blue-500/10 border-blue-500/30'
                        }`}>
                            {latestEmergency.status === 'resolved' ? '✅ Resolved' : latestEmergency.status === 'in progress' ? '🔄 In Progress' : '🚨 Help is on the way'}
                        </span>
                    </div>
                    
                    <div className="grid gap-6 sm:grid-cols-2 mb-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full ${
                                    latestEmergency.emergencyType === 'Fire' ? 'bg-red-500' :
                                    latestEmergency.emergencyType === 'Medical' ? 'bg-red-500' :
                                    latestEmergency.emergencyType === 'Security' ? 'bg-yellow-500' : 'bg-green-500'
                                }`}></div>
                                <div>
                                    <p className="text-white font-bold text-lg">{latestEmergency.emergencyType || 'General'}</p>
                                    <span className={`ml-2 px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(getPriority(latestEmergency.emergencyType))}`}>
                                        {getPriority(latestEmergency.emergencyType)} Priority
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
                                    <span className="text-white font-medium">{latestEmergency.assignedTo ? 'Yes' : 'Not yet assigned'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Location:</span>
                                    <span className="text-white font-medium">{latestEmergency.latitude?.toFixed(4) ?? 'N/A'}, {latestEmergency.longitude?.toFixed(4) ?? 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Reported:</span>
                                    <span className="text-white font-medium">{new Date(latestEmergency.createdAt.seconds * 1000).toLocaleString()}</span>
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
}

export default UserDashboard
