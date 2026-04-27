/**
 * Real-Time Status Indicator Component
 * Shows WebSocket connection status and live update indicator
 */

import React, { useEffect, useState } from 'react'
import { Activity, AlertCircle, CheckCircle2, Wifi, WifiOff } from 'lucide-react'
import { socketService } from '../utils/socketService'

export function LiveUpdateIndicator() {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  useEffect(() => {
    // Check connection status on mount
    const checkConnection = () => {
      const connected = socketService.isConnectedStatus()
      setIsConnected(connected)
      setConnectionStatus(connected ? 'connected' : 'disconnected')
    }

    checkConnection()

    // Listen for connection changes
    if (socketService.getSocket()) {
      socketService.getSocket().on('connect', () => {
        setIsConnected(true)
        setConnectionStatus('connected')
      })

      socketService.getSocket().on('disconnect', () => {
        setIsConnected(false)
        setConnectionStatus('disconnected')
      })

      socketService.getSocket().on('connect_error', () => {
        setIsConnected(false)
        setConnectionStatus('error')
      })
    }

    return () => {
      if (socketService.getSocket()) {
        socketService.getSocket().off('connect')
        socketService.getSocket().off('disconnect')
        socketService.getSocket().off('connect_error')
      }
    }
  }, [])

  if (connectionStatus === 'connected') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-green-600 animate-pulse" />
          <span className="text-sm font-medium text-green-700">Live Updates</span>
          <Wifi className="w-4 h-4 text-green-600" />
        </div>
      </div>
    )
  }

  if (connectionStatus === 'error' || connectionStatus === 'disconnected') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700">Using Fallback</span>
          <WifiOff className="w-4 h-4 text-amber-600" />
        </div>
      </div>
    )
  }

  // Connecting
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-sm font-medium text-blue-700">Connecting...</span>
      </div>
    </div>
  )
}

/**
 * Toast notification for real-time events
 */
export function RealtimeToast({ message, type = 'info', autoClose = 4000, onClose }) {
  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(onClose, autoClose)
      return () => clearTimeout(timer)
    }
  }, [autoClose, onClose])

  const bgColor = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200'
  }[type]

  const textColor = {
    success: 'text-green-700',
    error: 'text-red-700',
    warning: 'text-amber-700',
    info: 'text-blue-700'
  }[type]

  const icon = {
    success: <CheckCircle2 className="w-5 h-5 text-green-600" />,
    error: <AlertCircle className="w-5 h-5 text-red-600" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-600" />,
    info: <Activity className="w-5 h-5 text-blue-600" />
  }[type]

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${bgColor} animate-in slide-in-from-top-2`}
    >
      {icon}
      <span className={`text-sm font-medium ${textColor}`}>{message}</span>
    </div>
  )
}
