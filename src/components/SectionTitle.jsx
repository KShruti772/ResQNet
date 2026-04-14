function SectionTitle({ eyebrow, title, description }) {
    return (
        <div className="max-w-2xl space-y-3">
            {eyebrow && <p className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">{eyebrow}</p>}
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
            {description && <p className="text-slate-300">{description}</p>}
        </div>
    )
}

export default SectionTitle
