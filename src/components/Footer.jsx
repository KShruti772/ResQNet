import { Github, Mail, MapPin } from 'lucide-react'

function Footer() {
    return (
        <footer className="border-t border-white/10 bg-slate-950/90 px-6 py-12 text-slate-400">
            <div className="mx-auto flex max-w-7xl flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-xl space-y-4">
                    <p className="text-2xl font-semibold text-white">ResQNet</p>
                    <p className="text-sm leading-7 text-slate-400">
                        Unified Smart Emergency Response System built for hotels, campuses, events and cities that need fast, reliable crisis intelligence.
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                        <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> Global Operations</span>
                        <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" /> support@resqnet.io</span>
                    </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-3">
                    <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">Platform</p>
                        <ul className="mt-4 space-y-3 text-sm text-slate-300">
                            <li>Emergency Alerts</li>
                            <li>Live Tracking</li>
                            <li>Admin Controls</li>
                        </ul>
                    </div>
                    <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">Company</p>
                        <ul className="mt-4 space-y-3 text-sm text-slate-300">
                            <li>Careers</li>
                            <li>Documentation</li>
                            <li>Privacy</li>
                        </ul>
                    </div>
                    <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">Connect</p>
                        <div className="mt-4 flex items-center gap-4 text-slate-300">
                            <Github className="h-5 w-5" />
                            <span className="text-sm">@resqnet</span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}

export default Footer
