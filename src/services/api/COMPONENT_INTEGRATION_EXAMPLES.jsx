/**
 * Example Component Integration - Using the API Service Layer
 *
 * This file demonstrates best practices for using the API service layer
 * in React components.
 *
 * @file ComponentIntegrationExample.jsx
 */

import { useState, useEffect } from 'react'
import { apiClient } from '@/services/api'
import { useUser } from '@/UserContext'
import Toast from '@/components/Toast'
import Spinner from '@/components/Spinner'

/**
 * Example 1: Create Incident Form Component
 *
 * Demonstrates:
 * - API request with proper error handling
 * - Response validation
 * - User feedback (loading, success, error)
 * - Type checking for inputs
 */
function CreateIncidentExample() {
    const { user, userData } = useUser()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        emergencyType: 'general',
        location: { building: '', floor: '' }
    })

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        // Validate user is authenticated
        if (!user?.uid) {
            setError('You must be logged in to create an incident')
            setLoading(false)
            return
        }

        // Call API
        const response = await apiClient.incidents.create({
            title: formData.title,
            description: formData.description,
            emergencyType: formData.emergencyType,
            user: {
                uid: user.uid,
                organizationId: userData?.organizationId,
                fullName: userData?.fullName
            },
            location: formData.location
        })

        setLoading(false)

        // Handle response
        if (response.success) {
            setSuccess(`Incident ${response.data.id} created successfully`)
            setFormData({ title: '', description: '', emergencyType: 'general', location: { building: '', floor: '' } })
        } else {
            // Handle specific error codes
            if (response.error?.code === 'VALIDATION_ERROR') {
                setError(`Validation failed: ${JSON.stringify(response.error.details)}`)
            } else if (response.error?.code === 'UNAUTHORIZED') {
                setError('You must be logged in')
            } else {
                setError(response.error?.message || 'Failed to create incident')
            }
        }
    }

    return (
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-4">Create Incident</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Title</label>
                    <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Incident title"
                        className="w-full px-3 py-2 border rounded"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Describe the incident"
                        className="w-full px-3 py-2 border rounded"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select
                        value={formData.emergencyType}
                        onChange={(e) => setFormData({ ...formData, emergencyType: e.target.value })}
                        className="w-full px-3 py-2 border rounded"
                    >
                        <option value="fire">Fire</option>
                        <option value="medical">Medical</option>
                        <option value="security">Security</option>
                        <option value="general">General</option>
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                    {loading ? 'Creating...' : 'Create Incident'}
                </button>
            </form>

            {error && <Toast message={error} type="error" />}
            {success && <Toast message={success} type="success" />}
        </div>
    )
}

/**
 * Example 2: Incident List Component
 *
 * Demonstrates:
 * - Fetching data on component mount
 * - Real-time list updates
 * - Filtering and sorting
 * - Error recovery
 */
function IncidentListExample() {
    const { userData } = useUser()
    const [incidents, setIncidents] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [filter, setFilter] = useState('all')

    useEffect(() => {
        loadIncidents()
    }, [filter, userData?.organizationId])

    const loadIncidents = async () => {
        if (!userData?.organizationId) return

        setLoading(true)
        setError(null)

        const response = await apiClient.incidents.list({
            organizationId: userData.organizationId,
            status: filter === 'all' ? undefined : filter
        })

        setLoading(false)

        if (response.success) {
            setIncidents(response.data.incidents || [])
        } else {
            setError(response.error?.message || 'Failed to load incidents')
        }
    }

    if (loading) return <Spinner />
    if (error) return <div className="text-red-600">{error}</div>

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Incidents</h2>

            <div className="mb-4">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                    All
                </button>
                <button
                    onClick={() => setFilter('pending')}
                    className={`ml-2 px-4 py-2 rounded ${filter === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                    Pending
                </button>
                <button
                    onClick={() => setFilter('resolved')}
                    className={`ml-2 px-4 py-2 rounded ${filter === 'resolved' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                    Resolved
                </button>
            </div>

            <div className="space-y-4">
                {incidents.map((incident) => (
                    <div key={incident.id} className="p-4 border rounded bg-white">
                        <h3 className="font-bold text-lg">{incident.title}</h3>
                        <p className="text-gray-600">{incident.description}</p>
                        <div className="mt-2 flex justify-between text-sm text-gray-500">
                            <span>Status: {incident.status}</span>
                            <span>Type: {incident.type}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

/**
 * Example 3: Status Update Component
 *
 * Demonstrates:
 * - Optimistic updates
 * - Rollback on error
 * - Async operations
 */
function UpdateIncidentStatusExample({ incident, onUpdate }) {
    const { user, userData } = useUser()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const handleStatusChange = async (newStatus) => {
        setLoading(true)
        setError(null)

        // Optimistic update
        const previousStatus = incident.status
        onUpdate({ ...incident, status: newStatus })

        // Call API
        const response = await apiClient.incidents.updateStatus({
            incidentId: incident.id,
            status: newStatus,
            actor: {
                uid: user.uid,
                role: userData?.role || 'user',
                organizationId: userData?.organizationId
            }
        })

        setLoading(false)

        if (!response.success) {
            // Rollback on error
            onUpdate({ ...incident, status: previousStatus })
            setError(response.error?.message || 'Failed to update status')
        }
    }

    return (
        <div className="p-4 border rounded">
            <div className="mb-2">
                <span className="font-medium">Current Status: {incident.status}</span>
            </div>

            <div className="space-x-2">
                {['pending', 'accepted', 'in_progress', 'resolved'].map((status) => (
                    <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        disabled={loading || status === incident.status}
                        className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:bg-gray-400"
                    >
                        {status}
                    </button>
                ))}
            </div>

            {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}
        </div>
    )
}

/**
 * Example 4: Analytics Dashboard Component
 *
 * Demonstrates:
 * - Loading complex data
 * - Data transformation
 * - Conditional rendering
 */
function AnalyticsDashboardExample() {
    const { userData } = useUser()
    const [analytics, setAnalytics] = useState(null)
    const [performance, setPerformance] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadAnalytics()
    }, [userData?.organizationId])

    const loadAnalytics = async () => {
        if (!userData?.organizationId) return

        setLoading(true)

        // Load analytics
        const analyticsResponse = await apiClient.incidents.analytics(userData.organizationId)
        if (analyticsResponse.success) {
            setAnalytics(analyticsResponse.data)
        }

        // Load staff performance
        const performanceResponse = await apiClient.incidents.performance(userData.organizationId)
        if (performanceResponse.success) {
            setPerformance(performanceResponse.data)
        }

        setLoading(false)
    }

    if (loading) return <Spinner />

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-6">Analytics</h2>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="p-4 bg-blue-50 rounded border">
                    <div className="text-gray-600 text-sm">Total Incidents</div>
                    <div className="text-3xl font-bold text-blue-600">{analytics?.total_incidents || 0}</div>
                </div>
                <div className="p-4 bg-green-50 rounded border">
                    <div className="text-gray-600 text-sm">Avg Response Time</div>
                    <div className="text-3xl font-bold text-green-600">{analytics?.avg_response_time || 0}m</div>
                </div>
                <div className="p-4 bg-orange-50 rounded border">
                    <div className="text-gray-600 text-sm">Escalation Rate</div>
                    <div className="text-3xl font-bold text-orange-600">{analytics?.escalation_rate || 0}%</div>
                </div>
            </div>

            {/* Staff Performance Table */}
            <h3 className="text-xl font-bold mb-4">Staff Performance</h3>
            <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="border p-2 text-left">Staff Name</th>
                        <th className="border p-2 text-left">Incidents Handled</th>
                        <th className="border p-2 text-left">Avg Response Time</th>
                        <th className="border p-2 text-left">Avg Resolution Time</th>
                    </tr>
                </thead>
                <tbody>
                    {performance.map((staff) => (
                        <tr key={staff.staff_id} className="border-b">
                            <td className="border p-2">{staff.staff_name}</td>
                            <td className="border p-2">{staff.incidents_handled}</td>
                            <td className="border p-2">{staff.avg_response_time}m</td>
                            <td className="border p-2">{staff.avg_resolution_time}m</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

/**
 * Example 5: Error Boundary Component
 *
 * Wraps API calls with error handling
 */
function withApiErrorHandling(Component) {
    return function ErrorBoundary(props) {
        const [error, setError] = useState(null)

        if (error) {
            return (
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                    <h2 className="font-bold text-red-700">Error</h2>
                    <p className="text-red-600">{error}</p>
                    <button
                        onClick={() => setError(null)}
                        className="mt-2 px-4 py-2 bg-red-600 text-white rounded"
                    >
                        Dismiss
                    </button>
                </div>
            )
        }

        return <Component {...props} setError={setError} />
    }
}

export {
    CreateIncidentExample,
    IncidentListExample,
    UpdateIncidentStatusExample,
    AnalyticsDashboardExample,
    withApiErrorHandling
}
