import { useState, useEffect } from 'react'

export const useBrowserNotifications = () => {
    const [permission, setPermission] = useState(Notification.permission)
    const [isSupported, setIsSupported] = useState(false)

    useEffect(() => {
        setIsSupported('Notification' in window)
        
        if (isSupported && permission === 'default') {
            // Auto-request permission on first use
            Notification.requestPermission().then(setPermission)
        }
    }, [isSupported, permission])

    const requestPermission = async () => {
        if (!isSupported) return false
        
        const result = await Notification.requestPermission()
        setPermission(result)
        return result === 'granted'
    }

    const showNotification = (title, options = {}) => {
        if (!isSupported || permission !== 'granted') return null

        return new Notification(title, {
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            ...options
        })
    }

    return {
        isSupported,
        permission,
        requestPermission,
        showNotification
    }
}
