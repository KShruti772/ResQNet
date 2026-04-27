import { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import UserDashboard from './pages/UserDashboard.jsx'
import StaffDashboard from './pages/StaffDashboard.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import OrganizationSetup from './pages/OrganizationSetup.jsx'
import AuthLayout from './auth/AuthLayout.jsx'
import { UserProvider } from './UserContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

function App() {
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    return (
        <UserProvider>
            <div className="min-h-screen bg-slate-950 text-slate-100">
                <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur-md">
                    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
                        <NavLink to="/" className="flex items-center gap-3 text-lg font-semibold text-white">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-500 to-sky-500 shadow-soft">
                                R
                            </span>
                            ResQNet
                        </NavLink>
                        <button
                            type="button"
                            onClick={() => setMobileNavOpen((prev) => !prev)}
                            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-slate-900/80 p-2 text-slate-300 transition hover:bg-slate-800 focus:outline-none md:hidden"
                            aria-label="Toggle navigation"
                        >
                            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <nav className={`${mobileNavOpen ? 'block' : 'hidden'} w-full md:block`}>
                            <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-950/95 p-4 shadow-xl shadow-black/20 backdrop-blur-md md:flex-row md:items-center md:border-none md:bg-transparent md:p-0 md:shadow-none md:justify-end md:gap-4">
                                <NavLink to="/" onClick={() => setMobileNavOpen(false)} className={({ isActive }) => `rounded-2xl px-4 py-2 text-sm font-medium transition ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900/80 hover:text-white'} md:rounded-none md:px-0 md:py-0 md:hover:bg-transparent`}>
                                    Home
                                </NavLink>
                                <NavLink to="/login" onClick={() => setMobileNavOpen(false)} className={({ isActive }) => `rounded-2xl px-4 py-2 text-sm font-medium transition ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900/80 hover:text-white'} md:rounded-none md:px-0 md:py-0 md:hover:bg-transparent`}>
                                    Login
                                </NavLink>
                                <NavLink to="/register" onClick={() => setMobileNavOpen(false)} className={({ isActive }) => `rounded-2xl px-4 py-2 text-sm font-medium transition ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900/80 hover:text-white'} md:rounded-none md:px-0 md:py-0 md:hover:bg-transparent`}>
                                    Register
                                </NavLink>
                            </div>
                        </nav>
                    </div>
                </header>

                <main className="relative">
                    <Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
                        <Route path="/register" element={<AuthLayout><RegisterPage /></AuthLayout>} />
                        <Route path="/organization-setup" element={<OrganizationSetup />} />
                        <Route path="/user-dashboard" element={<ErrorBoundary><UserDashboard /></ErrorBoundary>} />
                        <Route path="/staff-dashboard" element={<ErrorBoundary><StaffDashboard /></ErrorBoundary>} />
                        <Route path="/admin-dashboard" element={<ErrorBoundary><AdminDashboard /></ErrorBoundary>} />
                        <Route path="*" element={<LandingPage />} />
                    </Routes>
                </main>
            </div>
        </UserProvider>
    )
}

export default App
