import { useState, useEffect } from 'react'

function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [showIndicator, setShowIndicator] = useState(false)

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true)
            setShowIndicator(true)
            setTimeout(() => setShowIndicator(false), 3000) // Hide after 3 seconds
        }

        const handleOffline = () => {
            setIsOnline(false)
            setShowIndicator(true)
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    if (!showIndicator) return null

    return (
        <div className={`fixed top-20 right-4 z-40 rounded-full px-4 py-2 text-sm font-medium shadow-lg transition-all duration-300 ${
            isOnline
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-200'
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-200'
        }`}>
            {isOnline ? '? Connected' : '? Offline Mode'}
        </div>
    )
}

export default OfflineIndicator
