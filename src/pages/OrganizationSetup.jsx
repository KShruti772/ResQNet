import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, setDoc, addDoc, collection, getDoc, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { useUser } from '../UserContext.jsx'

function OrganizationSetup() {
    const [mode, setMode] = useState('create')
    const [form, setForm] = useState({ name: '', type: 'hotel', location: '', contact: '', description: '' })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const navigate = useNavigate()
    const { updateUser } = useUser()

    const handleChange = (event) => {
        setForm({ ...form, [event.target.name]: event.target.value })
        setError('')
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        if (!form.name) {
            setError('Please enter organization name.')
            return
        }
        if (mode === 'create' && !form.location) {
            setError('Please fill in location.')
            return
        }
        setLoading(true)

        try {
            if (mode === 'join') {
                // Search for organization by name
                const q = query(collection(db, 'organizations'), where('name', '==', form.name))
                const querySnapshot = await getDocs(q)
                if (querySnapshot.empty) {
                    setError('Organization not found. Please check the name or create a new one.')
                    setLoading(false)
                    return
                }
                const orgDoc = querySnapshot.docs[0] // Take first match
                const orgId = orgDoc.id
                const orgData = orgDoc.data()

                // Update user with organizationId
                await setDoc(doc(db, 'users', auth.currentUser.uid), {
                    organizationId: orgId
                }, { merge: true })

                // Update context
                updateUser({ organizationId: orgId, organizationName: orgData.name })
            } else {
                // Create organization
                const orgRef = await addDoc(collection(db, 'organizations'), {
                    name: form.name,
                    type: form.type,
                    location: form.location,
                    contact: form.contact,
                    description: form.description,
                    createdBy: auth.currentUser.uid,
                    createdAt: new Date(),
                })

                // Update user with organizationId
                await setDoc(doc(db, 'users', auth.currentUser.uid), {
                    organizationId: orgRef.id
                }, { merge: true })

                // Update context
                updateUser({ organizationId: orgRef.id, organizationName: form.name })
            }

            // Fetch user role and navigate
            const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid))
            const userData = userSnap.data()
            const role = userData?.role || 'user'

            if (role === 'staff') {
                navigate('/staff-dashboard')
            } else if (role === 'admin') {
                navigate('/admin-dashboard')
            } else {
                navigate('/user-dashboard')
            }
        } catch (err) {
            console.error(err)
            setError(`Failed to ${mode} organization.`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="mx-auto max-w-4xl px-6 py-12">
            <div className="rounded-[2rem] border border-white/10 bg-slate-900/90 p-8 shadow-soft">
                <h1 className="text-3xl font-semibold text-white">Organization Setup</h1>
                <p className="mt-2 text-slate-300">Create a new organization or join an existing one.</p>

                <div className="mt-6 flex gap-4">
                    <button
                        type="button"
                        onClick={() => setMode('create')}
                        className={`rounded-3xl px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-105 ${mode === 'create' ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                        Create Organization
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('join')}
                        className={`rounded-3xl px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-105 ${mode === 'join' ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                        Join Organization
                    </button>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-sm font-medium text-slate-200">Organization Name</label>
                        <input
                            type="text"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder={mode === 'join' ? 'Enter exact organization name' : 'e.g. Grand Hotel'}
                            className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100"
                        />
                    </div>

                    {mode === 'create' && (
                        <>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-slate-200">Type</label>
                                    <select
                                        name="type"
                                        value={form.type}
                                        onChange={handleChange}
                                        className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100"
                                    >
                                        <option value="hotel">Hotel</option>
                                        <option value="school">School</option>
                                        <option value="college">College</option>
                                        <option value="event">Event</option>
                                        <option value="hospital">Hospital</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-200">Location</label>
                                    <input
                                        type="text"
                                        name="location"
                                        value={form.location}
                                        onChange={handleChange}
                                        placeholder="City, State"
                                        className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-slate-200">Contact Number</label>
                                    <input
                                        type="tel"
                                        name="contact"
                                        value={form.contact}
                                        onChange={handleChange}
                                        placeholder="+1 234 567 890"
                                        className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-200">Description</label>
                                    <input
                                        type="text"
                                        name="description"
                                        value={form.description}
                                        onChange={handleChange}
                                        placeholder="Optional description"
                                        className="mt-2 w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {error && <p className="rounded-3xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex w-full items-center justify-center rounded-3xl bg-gradient-to-r from-sky-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full border-2 border-slate-400 border-t-sky-500 h-4 w-4"></div>
                                {mode === 'join' ? 'Joining...' : 'Creating...'}
                            </div>
                        ) : (
                            mode === 'join' ? 'Join Organization' : 'Create Organization'
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default OrganizationSetup
