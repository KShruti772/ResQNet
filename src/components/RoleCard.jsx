function RoleCard({ selected, icon, title, description, onSelect }) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`group flex w-full flex-col rounded-[2rem] border p-6 text-left transition duration-300 ${selected ? 'border-sky-400/60 bg-slate-900 shadow-soft' : 'border-white/10 bg-slate-900/70 hover:border-sky-400/20 hover:bg-slate-900'
                }`}
        >
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-800 text-sky-300 shadow-lg shadow-sky-500/10">
                {icon}
            </div>
            <h3 className="text-xl font-semibold text-white">{title}</h3>
            <p className="mt-2 text-slate-300">{description}</p>
            {selected && <span className="mt-4 inline-flex rounded-full bg-sky-500/10 px-3 py-1 text-sm text-sky-200">Selected</span>}
        </button>
    )
}

export default RoleCard
