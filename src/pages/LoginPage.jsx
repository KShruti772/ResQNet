import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AtSign, Lock } from 'lucide-react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'

function LoginPage() {
    const [form, setForm] = useState({ email: '', password: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const navigate = useNavigate()

    const handleChange = (event) => {
        setForm({ ...form, [event.target.name]: event.target.value })
        setError('')
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        if (!form.email || !form.password) {
            setError('Please enter both email and password.')
            return
        }
        setLoading(true)

        try {
            console.log('Login Step 1: Start')
            const userCredential = await signInWithEmailAndPassword(auth, form.email, form.password)
            console.log('Login Step 2: Auth successful')
            console.log('Auth user:', userCredential.user)
            console.log('Fetching Firestore doc...')
            const userRef = doc(db, 'users', userCredential.user.uid)
            const userSnap = await getDoc(userRef)
            const data = userSnap.exists() ? userSnap.data() : null
            const role = data?.role || 'user'
            const orgId = data?.organizationId
            console.log('Login Step 3: Role fetched:', role)
            console.log('Login Step 3.5: OrgId fetched:', orgId)

            if (!orgId) {
                console.log('Login Step 4: No orgId, redirecting to organization setup')
                navigate('/organization-setup')
                return
            }

            console.log('Login Step 4: Login completed, navigating to dashboard')

            if (role === 'staff') {
                navigate('/staff-dashboard')
            } else if (role === 'admin') {
                navigate('/admin-dashboard')
            } else {
                navigate('/user-dashboard')
            }
        } catch (authError) {
            console.error("ERROR CODE:", authError.code)
            console.error("ERROR MESSAGE:", authError.message)
            alert(`Login error: ${authError.message}`)
            setError(`Login error: ${authError.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="mx-auto max-w-3xl">
            <div className="rounded-[2rem] bg-slate-950/90 p-8 shadow-soft sm:p-10">
                <div className="mb-8 flex items-center gap-4 rounded-3xl bg-slate-900/80 p-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-500 to-fuchsia-500 text-white">R</div>
                    <div>
                        <p className="text-sm uppercase tracking-[0.28em] text-cyan-300/80">ResQNet Login</p>
                        <h2 className="text-2xl font-semibold text-white">Access your response workspace.</h2>
                    </div>
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-200">Email</label>
                        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-900/80 px-4 py-3 focus-within:border-sky-400/50">
                            <AtSign className="h-5 w-5 text-slate-400" />
                            <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
                                placeholder="your@email.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-200">Password</label>
                        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-900/80 px-4 py-3 focus-within:border-sky-400/50">
                            <Lock className="h-5 w-5 text-slate-400" />
                            <input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
                                placeholder="Enter password"
                            />
                        </div>
                    </div>

                    {error && <p className="rounded-3xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

                    <button
                        type="submit"
                        className="inline-flex w-full items-center justify-center rounded-3xl bg-gradient-to-r from-sky-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={loading}
                    >
                        {loading ? 'Validating...' : 'Login'}
                    </button>

                    <p className="text-center text-sm text-slate-400">
                        Don&apos;t have an account?{' '}
                        <a href="/register" className="font-semibold text-white hover:text-sky-300">
                            Register
                        </a>
                    </p>
                </form>
            </div>
        </div>
    )
}

export default LoginPage
