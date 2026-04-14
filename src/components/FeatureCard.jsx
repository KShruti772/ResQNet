function FeatureCard({ title, description, accent, icon }) {
    return (
        <article className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-sky-400/20 hover:bg-slate-900">
            <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-800 text-sky-300 shadow-lg shadow-sky-500/10">
                {icon}
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">{accent}</p>
            <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
            <p className="mt-3 text-slate-300">{description}</p>
            <div className="pointer-events-none absolute inset-x-0 -bottom-4 h-24 bg-gradient-to-t from-slate-950 opacity-0 transition duration-300 group-hover:opacity-100"></div>
        </article>
    )
}

export default FeatureCard
