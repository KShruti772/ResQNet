import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ShieldAlert, User, Users } from 'lucide-react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import RoleCard from '../components/RoleCard.jsx'
import { auth, db } from '../firebase.js'

const roleOptions = [
    {
        key: 'user',
        title: 'User',
        description: 'Report emergencies instantly',
        icon: <User className="h-6 w-6" />,
    },
    {
        key: 'staff',
        title: 'Staff',
        description: 'Respond and manage incidents',
        icon: <Users className="h-6 w-6" />,
    },
    {
        key: 'admin',
        title: 'Admin',
        description: 'Monitor and control system',
        icon: <ShieldAlert className="h-6 w-6" />,
    },
]

function RegisterPage() {
    const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' })
    const [role, setRole] = useState('user')
    const [loading, setLoading] = useState(false)
    const [feedback, setFeedback] = useState('')
    const [error, setError] = useState('')

    const handleChange = (event) => {
        setForm({ ...form, [event.target.name]: event.target.value })
        setError('')
    }

    const navigate = useNavigate()

    const handleSubmit = async (event) => {
        event.preventDefault()
        if (!form.fullName || !form.email || !form.phone || !form.password || !form.confirm) {
            setError('Please complete all fields.')
            return
        }
        if (form.password !== form.confirm) {
            setError('Passwords do not match.')
            return
        }
        setLoading(true)
        setError('')

        try {
            console.log('Step 1: Start signup')
            const credential = await createUserWithEmailAndPassword(auth, form.email, form.password)
            console.log('Step 2: User created')
            await setDoc(doc(db, 'users', credential.user.uid), {
                uid: credential.user.uid,
                fullName: form.fullName,
                email: form.email,
                phone: form.phone,
                role,
                organizationId: '',
                active_incidents_count: 0,
                createdAt: serverTimestamp(),
            })
            console.log('Step 3: Firestore saved')
            setFeedback(`Account created for ${role.toUpperCase()}. Please log in.`)
            setForm({ fullName: '', email: '', phone: '', password: '', confirm: '' })
            setRole('user')
            console.log('Step 4: Signup completed, navigating')
            navigate('/organization-setup')
        } catch (registerError) {
            console.error('ERROR CODE:', registerError.code)
            console.error('ERROR MESSAGE:', registerError.message)
            const message = registerError?.message || 'Signup failed. Please try again.'
            setError(message)
            alert(message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="mx-auto max-w-4xl">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[2rem] border border-white/10 bg-slate-900/85 p-8 shadow-soft sm:p-10">
                    <div className="mb-8">
                        <p className="text-sm uppercase tracking-[0.32em] text-cyan-300/80">Create account</p>
                        <h2 className="mt-4 text-3xl font-semibold text-white">Join the network built for rapid response.</h2>
                    </div>
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {[
                                { label: 'Full Name', name: 'fullName', placeholder: 'Jane Doe' },
                                { label: 'Email', name: 'email', placeholder: 'jane@resqnet.io' },
                            ].map((field) => (
                                <label key={field.name} className="block text-sm text-slate-200">
                                    <span className="font-medium">{field.label}</span>
                                    <input
                                        type={field.name === 'email' ? 'email' : 'text'}
                                        name={field.name}
                                        value={form[field.name]}
                                        onChange={handleChange}
                                        placeholder={field.placeholder}
                                        className="mt-3 w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-400/60"
                                    />
                                </label>
                            ))}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block text-sm text-slate-200">
                                <span className="font-medium">Mobile Number</span>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={form.phone}
                                    onChange={handleChange}
                                    placeholder="+1 234 567 890"
                                    className="mt-3 w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-400/60"
                                />
                            </label>
                            <label className="block text-sm text-slate-200">
                                <span className="font-medium">Password</span>
                                <input
                                    type="password"
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder="Create a password"
                                    className="mt-3 w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-400/60"
                                />
                            </label>
                        </div>
                        <label className="block text-sm text-slate-200">
                            <span className="font-medium">Confirm Password</span>
                            <input
                                type="password"
                                name="confirm"
                                value={form.confirm}
                                onChange={handleChange}
                                placeholder="Repeat password"
                                className="mt-3 w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-sky-400/60"
                            />
                        </label>

                        <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-6">
                            <div className="mb-6 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm uppercase tracking-[0.28em] text-cyan-300/80">Role selection</p>
                                    <p className="mt-2 text-slate-300">Choose the role that best matches your access level.</p>
                                </div>
                                <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-sm text-sky-200">
                                    <CheckCircle2 className="h-4 w-4" /> Selected: {role.toUpperCase()}
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                                {roleOptions.map((option) => (
                                    <RoleCard
                                        key={option.key}
                                        selected={role === option.key}
                                        icon={option.icon}
                                        title={option.title}
                                        description={option.description}
                                        onSelect={() => setRole(option.key)}
                                    />
                                ))}
                            </div>
                        </div>

                        {error && <p className="rounded-3xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
                        {feedback && <p className="rounded-3xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{feedback}</p>}

                        <button
                            type="submit"
                            className="inline-flex w-full items-center justify-center rounded-3xl bg-gradient-to-r from-fuchsia-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={loading}
                        >
                            {loading ? 'Creating account...' : 'Register'}
                        </button>
                    </form>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-8 shadow-soft">
                    <div className="space-y-6">
                        <div className="rounded-3xl bg-slate-950/75 p-5">
                            <p className="text-sm uppercase tracking-[0.32em] text-cyan-300/80">Why role-based access?</p>
                            <p className="mt-3 text-slate-300">ResQNet separates guest reporting, responder operations, and system administration so each user sees only relevant tools and data.</p>
                        </div>
                        <div className="space-y-4">
                            {[
                                'Users report emergencies with confidence.',
                                'Staff manage incidents and communicate faster.',
                                'Admins oversee system health and team performance.',
                            ].map((point) => (
                                <div key={point} className="flex items-center gap-3 rounded-3xl bg-slate-950/80 p-4">
                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-3xl bg-sky-500/10 text-sky-300">✓</span>
                                    <p className="text-slate-300">{point}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RegisterPage
