import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, doc, onSnapshot, updateDoc, query, where, getDoc, addDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { useUser } from '../UserContext.jsx'
import Toast from '../components/Toast.jsx'
import Spinner from '../components/Spinner.jsx'
import EmergencyMap from '../components/EmergencyMap.jsx'
import StatusTimeline from '../components/StatusTimeline.jsx'
import { getPriority, getPriorityColor, getResponseTime, playAlertSound } from '../utils/emergencyUtils.js'

function AdminDashboard() {
    const [emergencies, setEmergencies] = useState([])
    const [error, setError] = useState('')
    const [filter, setFilter] = useState('all')
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

        const q = query(collection(db, 'emergencies'), where('organizationId', '==', user.organizationId))
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const newEmergencies = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }))
                const prevCount = emergencies.length
                setEmergencies(newEmergencies)
                if (newEmergencies.length > prevCount) {
                    playAlertSound()
                    setToast({ message: '🚨 New Emergency Reported', type: 'warning' })
                }
            },
            () => {
                setError('Unable to load emergency alerts.')
            }
        )
        return unsubscribe
    }, [user])

    const updateStatus = async (id, status) => {
        try {
            await updateDoc(doc(db, 'emergencies', id), { status })
        } catch (updateError) {
            setError('Failed to update status. Please try again.')
        }
    }

    const createDemoEmergency = async () => {
        try {
            const demoTypes = ['Fire', 'Medical', 'Security', 'General']
            const randomType = demoTypes[Math.floor(Math.random() * demoTypes.length)]
            const demoDescriptions = {
                'Fire': 'Building fire reported',
                'Medical': 'Person needs immediate medical attention',
                'Security': 'Suspicious activity detected',
                'General': 'General emergency assistance needed'
            }

            await addDoc(collection(db, 'emergencies'), {
                userId: 'demo-user',
                userName: 'Demo User',
                phone: '+1-555-0123',
                emergencyType: randomType,
                description: demoDescriptions[randomType],
                latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
                longitude: -74.0060 + (Math.random() - 0.5) * 0.1,
                status: 'pending',
                assignedTo: null,
                organizationId: user.organizationId,
                createdAt: new Date(),
            })
            setToast({ message: '🎭 Demo emergency created!', type: 'success' })
        } catch (error) {
            setError('Failed to create demo emergency.')
        }
    }

    const filteredEmergencies = emergencies.filter((emergency) => {
        if (filter === 'all') return true
        return emergency.status === filter
    })

    const total = emergencies.length
    const active = emergencies.filter((e) => e.status !== 'resolved').length
    const resolved = emergencies.filter((e) => e.status === 'resolved').length
    const avgResponseTime = resolved > 0 ? Math.floor(emergencies.filter(e => e.status === 'resolved').reduce((sum, e) => sum + (Date.now() - e.createdAt.seconds * 1000) / 60000, 0) / resolved) : 0

    const emergenciesByType = emergencies.reduce((acc, emergency) => {
        const type = emergency.emergencyType || 'General'
        acc[type] = (acc[type] || 0) + 1
        return acc
    }, {})

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
                                <p className="text-slate-300 text-lg">{user?.organizationName || 'Organization'}</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400">Emergency Management Control Center • {user?.role || 'admin'}</p>
                    </div>
                    <button
                        onClick={() => navigate('/organization-setup')}
                        className="rounded-xl bg-slate-700/50 px-4 py-2 text-sm font-semibold text-slate-300 transition-all duration-300 hover:scale-105 hover:bg-slate-600/50 border border-white/10 hover:border-white/20"
                    >
                        Change Organization
                    </button>
                </div>
            </div>

            {/* Analytics Cards */}
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <div className="text-4xl font-bold text-cyan-400 mb-2">{total}</div>
                    <p className="text-slate-300 font-medium">Total Emergencies</p>
                    <div className="mt-3 h-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"></div>
                </div>
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <div className="text-4xl font-bold text-orange-400 mb-2">{active}</div>
                    <p className="text-slate-300 font-medium">Active Cases</p>
                    <div className="mt-3 h-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
                </div>
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <div className="text-4xl font-bold text-emerald-400 mb-2">{resolved}</div>
                    <p className="text-slate-300 font-medium">Resolved</p>
                    <div className="mt-3 h-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full"></div>
                </div>
                <div className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/80 p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                    <div className="text-4xl font-bold text-yellow-400 mb-2">{avgResponseTime}</div>
                    <p className="text-slate-300 font-medium">Avg Response (min)</p>
                    <div className="mt-3 h-1 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full"></div>
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
                            { status: 'in progress', label: 'In Progress', count: emergencies.filter(e => e.status === 'in progress').length, color: 'bg-orange-500' },
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
                    {emergencies.filter(e => e.assignedTo).slice(0, 6).map((emergency) => (
                        <div key={emergency.id} className="bg-slate-950/50 rounded-lg p-4 border border-white/5">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                    <span className="text-xs font-bold text-white">👨‍⚕️</span>
                                </div>
                                <div>
                                    <p className="text-white font-medium text-sm">Staff Assigned</p>
                                    <p className="text-slate-400 text-xs">{emergency.userName || 'User'}</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Type:</span>
                                    <span className="text-slate-300">{emergency.emergencyType}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Status:</span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        emergency.status === 'resolved' ? 'text-emerald-300 bg-emerald-500/10' :
                                        emergency.status === 'in progress' ? 'text-orange-300 bg-orange-500/10' :
                                        'text-blue-300 bg-blue-500/10'
                                    }`}>
                                        {emergency.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {emergencies.filter(e => e.assignedTo).length === 0 && (
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
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 hover:scale-105 ${
                            filter === 'all' 
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30' 
                                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-white/10 hover:border-white/20'
                        }`}
                    >
                        All Cases
                    </button>
                    <button
                        onClick={() => setFilter('pending')}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 hover:scale-105 ${
                            filter === 'pending' 
                                ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white shadow-lg shadow-yellow-500/30' 
                                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-white/10 hover:border-white/20'
                        }`}
                    >
                        Pending
                    </button>
                    <button
                        onClick={() => setFilter('in progress')}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 hover:scale-105 ${
                            filter === 'in progress' 
                                ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/30' 
                                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-white/10 hover:border-white/20'
                        }`}
                    >
                        In Progress
                    </button>
                    <button
                        onClick={() => setFilter('resolved')}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 hover:scale-105 ${
                            filter === 'resolved' 
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
                            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6 shadow-xl backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-500/10"
                        >
                            {/* Priority Indicator */}
                            <div className="absolute top-4 right-4">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                    getPriority(emergency) === 'Critical' 
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
                                        {emergency.emergencyType || emergency.type || 'Emergency'}
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
                                        <span>{emergency.location || 'Location not specified'}</span>
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
                                        <span>{emergency.assignedTo || 'Unassigned'}</span>
                                    </div>
                                </div>

                                {/* Status & Actions */}
                                <div className="flex items-center justify-between">
                                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                                        emergency.status === 'pending' 
                                            ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-300 border border-yellow-500/30' 
                                            : emergency.status === 'in progress' 
                                            ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 border border-orange-500/30' 
                                            : 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-300 border border-emerald-500/30'
                                    }`}>
                                        {emergency.status.toUpperCase()}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => updateEmergencyStatus(emergency.id, 'in progress')}
                                            className="rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-105 hover:shadow-blue-500/50"
                                        >
                                            Start
                                        </button>
                                        <button
                                            onClick={() => updateEmergencyStatus(emergency.id, 'resolved')}
                                            className="rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:scale-105 hover:shadow-emerald-500/50"
                                        >
                                            Resolve
                                        </button>
                                    </div>
                                </div>

                                {/* Timeline */}
                                <div className="mt-4">
                                    <StatusTimeline emergency={emergency} />
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
