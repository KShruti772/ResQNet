function AuthLayout({ children }) {
    return (
        <div className="relative overflow-hidden bg-slate-950 py-16">
            <div className="absolute inset-x-0 top-0 h-72 bg-hero opacity-60 blur-3xl" />
            <div className="relative mx-auto max-w-5xl px-6">
                <div className="mb-10 rounded-[2rem] border border-slate-700/80 bg-slate-900/80 p-8 shadow-soft backdrop-blur-xl sm:p-12">
                    <div className="mb-8 flex flex-col gap-3 text-center sm:text-left">
                        <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">ResQNet Auth</p>
                        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Secure access for every emergency role.</h1>
                        <p className="max-w-2xl text-slate-300">Sign in or create an account with a role-based workflow designed for fast, modern response operations.</p>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    )
}

export default AuthLayout
