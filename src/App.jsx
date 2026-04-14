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

function App() {
    return (
        <UserProvider>
            <div className="min-h-screen bg-slate-950 text-slate-100">
                <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur-md">
                    <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                        <NavLink to="/" className="flex items-center gap-3 text-lg font-semibold text-white">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-500 to-sky-500 shadow-soft">
                                R
                            </span>
                            ResQNet
                        </NavLink>

                        <nav className="flex items-center gap-4 text-sm text-slate-300">
                            <NavLink to="/" className={({ isActive }) => isActive ? 'text-white' : 'hover:text-white'}>Home</NavLink>
                            <NavLink to="/login" className={({ isActive }) => isActive ? 'text-white' : 'hover:text-white'}>Login</NavLink>
                            <NavLink to="/register" className={({ isActive }) => isActive ? 'text-white' : 'hover:text-white'}>Register</NavLink>
                        </nav>
                    </div>
                </header>

                <main className="relative">
                    <Routes>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
                        <Route path="/register" element={<AuthLayout><RegisterPage /></AuthLayout>} />
                        <Route path="/organization-setup" element={<OrganizationSetup />} />
                        <Route path="/user-dashboard" element={<UserDashboard />} />
                        <Route path="/staff-dashboard" element={<StaffDashboard />} />
                        <Route path="/admin-dashboard" element={<AdminDashboard />} />
                        <Route path="*" element={<LandingPage />} />
                    </Routes>
                </main>
            </div>
        </UserProvider>
    )
}

export default App
