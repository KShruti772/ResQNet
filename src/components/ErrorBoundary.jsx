import React from 'react'

const isDevelopment = import.meta.env.DEV

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true }
    }

    componentDidCatch(error, errorInfo) {
        // Log the error details
        console.error('ErrorBoundary caught an error:', error, errorInfo)

        this.setState({
            error: error,
            errorInfo: errorInfo
        })

        // Optional: Send error to logging service
        if (window.gtag) {
            window.gtag('event', 'exception', {
                description: error.toString(),
                fatal: false
            })
        }
    }

    render() {
        if (this.state.hasError) {
            // Fallback UI
            return (
                <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-900/20 to-red-800/20">
                    <div className="text-center max-w-md mx-auto p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-red-500/20">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
                        <p className="text-red-200 mb-4">
                            The application encountered an unexpected error. Please refresh the page or contact support if the problem persists.
                        </p>
                        <div className="space-y-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                Refresh Page
                            </button>
                            <button
                                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                                className="w-full bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                        {isDevelopment && (
                            <details className="mt-4 text-left">
                                <summary className="text-red-300 cursor-pointer">Error Details (Development)</summary>
                                <pre className="text-xs text-red-200 mt-2 whitespace-pre-wrap bg-black/20 p-2 rounded">
                                    {this.state.error && this.state.error.toString()}
                                    <br />
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
