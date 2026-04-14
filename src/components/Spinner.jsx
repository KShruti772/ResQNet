function Spinner({ size = 'sm' }) {
    const sizes = {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8'
    }

    return (
        <div className={`animate-spin rounded-full border-2 border-slate-400 border-t-sky-500 ${sizes[size]}`}></div>
    )
}

export default Spinner