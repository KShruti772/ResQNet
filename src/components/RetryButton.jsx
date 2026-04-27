function RetryButton({ onClick, loading, disabled, count = 0, label = 'Retry', className = '' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || loading}
            className={`inline-flex items-center justify-center rounded-xl border border-white/10 bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        >
            {loading ? 'Retrying...' : `${label}${count ? ` (${count})` : ''}`}
        </button>
    )
}

export default RetryButton
