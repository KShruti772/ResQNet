import { useEffect } from 'react'

function Toast({ message, type = 'info', onClose, duration = 4000 }) {
    useEffect(() => {
        const timer = setTimeout(onClose, duration)
        return () => clearTimeout(timer)
    }, [onClose, duration])

    const colors = {
        success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200',
        error: 'bg-rose-500/10 border-rose-500/20 text-rose-200',
        warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-200',
        info: 'bg-sky-500/10 border-sky-500/20 text-sky-200'
    }

    return (
        <div className={`fixed top-4 right-4 z-50 rounded-3xl border px-4 py-3 shadow-lg ${colors[type]} animate-in slide-in-from-right-full duration-300`}>
            <p className="text-sm font-medium">{message}</p>
        </div>
    )
}

export default Toast