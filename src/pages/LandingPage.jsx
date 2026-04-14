import { ArrowRight, CloudLightning, HeartPulse, MapPin, ShieldCheck, Sparkles } from 'lucide-react'
import FeatureCard from '../components/FeatureCard.jsx'
import SectionTitle from '../components/SectionTitle.jsx'
import Footer from '../components/Footer.jsx'

const features = [
    {
        title: 'Panic Button',
        description: 'Trigger emergency alerts with a single tap and get response teams mobilized instantly.',
        accent: 'Instant Alert',
        icon: <CloudLightning className="h-6 w-6" />,
    },
    {
        title: 'Live Location Tracking',
        description: 'Share precise location data so responders arrive at the scene without delay.',
        accent: 'Precision',
        icon: <MapPin className="h-6 w-6" />,
    },
    {
        title: 'Real-Time Notifications',
        description: 'Receive live updates through every incident phase and maintain situational awareness.',
        accent: 'Visibility',
        icon: <HeartPulse className="h-6 w-6" />,
    },
    {
        title: 'Admin Dashboard',
        description: 'Monitor operations, assign teams, and track incident metrics from one command center.',
        accent: 'Control',
        icon: <ShieldCheck className="h-6 w-6" />,
    },
    {
        title: 'AI Emergency Classification',
        description: 'Smart classification detects severity and prioritizes response to save more lives.',
        accent: 'Intelligence',
        icon: <Sparkles className="h-6 w-6" />,
    },
]

const sectors = ['Hotels', 'Colleges', 'Events', 'Smart Cities']
const workflow = [
    { label: 'User triggers emergency', description: 'One tap sends a verified alert into the system.' },
    { label: 'System captures location', description: 'Automated GPS tracking points responders to the exact scene.' },
    { label: 'Alerts sent instantly', description: 'Staff receive prioritized notifications without manual delay.' },
    { label: 'Response team resolves', description: 'Verified responders arrive fast and manage the incident end-to-end.' },
]

function LandingPage() {
    return (
        <div className="relative overflow-hidden bg-slate-950">
            <section className="relative px-6 pt-12 pb-20 sm:pt-16 lg:px-8">
                <div className="absolute inset-x-0 top-0 h-96 bg-hero opacity-50 blur-3xl" />
                <div className="relative mx-auto flex max-w-7xl flex-col gap-16 lg:flex-row lg:items-center lg:justify-between">
                    <div className="max-w-2xl space-y-8">
                        <span className="inline-flex rounded-full bg-slate-800/70 px-4 py-2 text-sm font-semibold uppercase tracking-[0.32em] text-cyan-300/90">Unified Smart Emergency Response</span>
                        <div className="space-y-5">
                            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                                ResQNet
                                <span className="block text-cyan-300">One Tap. Instant Response. Save Lives.</span>
                            </h1>
                            <p className="max-w-xl text-lg leading-8 text-slate-300">
                                A premium emergency platform for modern facilities and cities, built to reduce response gaps and keep every community safer.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-4">
                            <a href="#solution" className="inline-flex items-center gap-2 rounded-3xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5">
                                Get Started <ArrowRight className="h-4 w-4" />
                            </a>
                            <a href="/login" className="inline-flex items-center justify-center rounded-3xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:border-sky-400/30">
                                Login
                            </a>
                        </div>
                    </div>

                    <div className="rounded-[2.5rem] border border-white/10 bg-slate-900/80 p-8 shadow-soft shadow-slate-950/50 backdrop-blur-xl">
                        <div className="space-y-6">
                            <div className="rounded-3xl bg-slate-800/80 p-6">
                                <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Live View</p>
                                <h2 className="mt-3 text-2xl font-semibold text-white">Fast response starts here.</h2>
                                <p className="mt-2 text-slate-300">Tracking emergency incidents, responders, and mission-critical alerts in one intuitive interface.</p>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="rounded-3xl bg-slate-950/80 p-4 ring-1 ring-white/10">
                                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Coverage</p>
                                    <p className="mt-3 text-3xl font-semibold text-white">4+</p>
                                </div>
                                <div className="rounded-3xl bg-slate-950/80 p-4 ring-1 ring-white/10">
                                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Response</p>
                                    <p className="mt-3 text-3xl font-semibold text-white"><span className="text-cyan-300">Instant</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-t border-white/10 px-6 py-16 lg:px-8">
                <div className="mx-auto max-w-6xl grid gap-10 lg:grid-cols-2 lg:gap-12">
                    <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-10 shadow-soft backdrop-blur-xl">
                        <SectionTitle
                            eyebrow="About the problem"
                            title="Emergency response is still too slow and siloed."
                            description="Outdated alerting, manual coordination, and missing data create dangerous delays when every second matters."
                        />
                        <div className="mt-10 space-y-4">
                            {[
                                'Delayed dispatch decisions increase risk to people and property.',
                                'Emergency teams often lack live location and severity context.',
                                'Multiple systems create confusion during critical moments.',
                            ].map((item) => (
                                <div key={item} className="flex items-start gap-4 rounded-3xl bg-slate-950/80 p-4">
                                    <span className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-3xl bg-slate-800 text-cyan-300">•</span>
                                    <p className="text-slate-300">{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900/70 to-slate-950/80 p-10 shadow-soft backdrop-blur-xl">
                        <SectionTitle
                            eyebrow="ResQNet solution"
                            title="A single platform that connects users, staff, and operations."
                            description="From alert to arrival, the system powers faster decisions with location, notifications, and incident oversight."
                        />
                        <div className="mt-10 space-y-5">
                            {[
                                { title: 'Panic Button', detail: 'One tap instant alert from any user device.' },
                                { title: 'Smart Tracking', detail: 'Live emergency location and route context for responders.' },
                                { title: 'AI Prioritization', detail: 'Classifies severity and escalates the right team automatically.' },
                            ].map((item) => (
                                <div key={item.title} className="rounded-3xl bg-slate-950/80 p-5 ring-1 ring-white/10">
                                    <h3 className="font-semibold text-white">{item.title}</h3>
                                    <p className="mt-2 text-slate-300">{item.detail}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section id="solution" className="px-6 py-16 lg:px-8">
                <div className="mx-auto max-w-7xl space-y-10">
                    <SectionTitle
                        eyebrow="How it works"
                        title="A fast, clear flow from incident to response."
                        description="Designed for teams to act immediately with the right information and coordinated execution."
                    />
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                        {workflow.map((item, index) => (
                            <div key={item.label} className="rounded-[2rem] border border-white/10 bg-slate-900/75 p-7 shadow-soft transition hover:-translate-y-1">
                                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-sky-500/10 text-sky-300">{index + 1}</div>
                                <h3 className="text-xl font-semibold text-white">{item.label}</h3>
                                <p className="mt-3 text-slate-300">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="border-t border-white/10 px-6 py-16 lg:px-8">
                <div className="mx-auto max-w-7xl space-y-10">
                    <SectionTitle eyebrow="Key features" title="Built for real emergencies, not just alerts." />
                    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                        {features.map((item) => (
                            <FeatureCard key={item.title} {...item} />
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-slate-950/95 px-6 py-16 lg:px-8">
                <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-slate-900/70 p-10 shadow-soft backdrop-blur-xl">
                    <div className="md:flex md:items-center md:justify-between">
                        <div>
                            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300/80">Open innovation</p>
                            <h2 className="mt-4 text-3xl font-semibold text-white">Trusted by teams across modern facilities.</h2>
                        </div>
                        <div className="mt-6 flex flex-wrap gap-3 sm:mt-0">
                            {sectors.map((name) => (
                                <span key={name} className="rounded-3xl border border-white/10 bg-slate-950/80 px-5 py-3 text-sm text-slate-200">{name}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    )
}

export default LandingPage
