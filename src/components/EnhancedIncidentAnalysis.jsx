import React, { useState, useEffect } from 'react'
import { analyzeIncident } from '../../services/geminiService.js'
import { getEnhancedPriorityColor } from '../utils/emergencyUtils.js'

/**
 * Enhanced Incident Analysis Component
 * Demonstrates the improved AI capabilities with pattern detection and better recommendations
 */
function EnhancedIncidentAnalysis({ incident, onAnalysisComplete }) {
    const [analysis, setAnalysis] = useState(null)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (incident && !analysis) {
            performAnalysis()
        }
    }, [incident])

    const performAnalysis = async () => {
        if (!incident?.title || !incident?.description) return

        setIsAnalyzing(true)
        setError(null)

        try {
            const result = await analyzeIncident(incident.title, incident.description)
            setAnalysis(result)

            // Notify parent component
            if (onAnalysisComplete) {
                onAnalysisComplete(result)
            }
        } catch (err) {
            console.error('Analysis failed:', err)
            setError('AI analysis temporarily unavailable')
        } finally {
            setIsAnalyzing(false)
        }
    }

    if (isAnalyzing) {
        return (
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <span className="text-slate-300">Analyzing incident with AI...</span>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-red-900/20 rounded-lg p-4 border border-red-700/50">
                <p className="text-red-300 text-sm">{error}</p>
                <button
                    onClick={performAnalysis}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
                >
                    Retry Analysis
                </button>
            </div>
        )
    }

    if (!analysis) return null

    return (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 space-y-4">
            {/* AI Analysis Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">AI Incident Analysis</h3>
                <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${analysis.confidence > 0.8 ? 'bg-green-500/20 text-green-300' :
                            analysis.confidence > 0.6 ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-red-500/20 text-red-300'
                        }`}>
                        {Math.round(analysis.confidence * 100)}% confidence
                    </span>
                </div>
            </div>

            {/* Type and Priority */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wide">Type</label>
                    <p className="text-white font-medium capitalize">{analysis.type}</p>
                </div>
                <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wide">Priority</label>
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium capitalize ${getEnhancedPriorityColor(analysis.priority, incident?.pattern_detected)}`}>
                        {analysis.priority}
                    </span>
                </div>
            </div>

            {/* AI Summary */}
            <div>
                <label className="text-xs text-slate-400 uppercase tracking-wide">AI Summary</label>
                <p className="text-slate-200 mt-1">{analysis.summary}</p>
            </div>

            {/* Recommendations */}
            <div>
                <label className="text-xs text-slate-400 uppercase tracking-wide">Recommended Actions</label>
                <div className="mt-2 space-y-2">
                    {analysis.recommendations.map((rec, index) => (
                        <div key={index} className="flex items-start space-x-2">
                            <span className="flex-shrink-0 w-5 h-5 bg-blue-500/20 text-blue-300 rounded-full flex items-center justify-center text-xs font-medium">
                                {index + 1}
                            </span>
                            <p className="text-slate-200 text-sm">{rec}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Pattern Detection Alert */}
            {incident?.pattern_detected && (
                <div className="bg-orange-900/20 border border-orange-700/50 rounded-lg p-3">
                    <div className="flex items-start space-x-2">
                        <span className="text-orange-400">⚠️</span>
                        <div>
                            <p className="text-orange-200 font-medium text-sm">Pattern Detected</p>
                            <p className="text-orange-300 text-xs mt-1">{incident.pattern_note}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default EnhancedIncidentAnalysis