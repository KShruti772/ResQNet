import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = import.meta.env?.VITE_GEMINI_API_KEY || ''
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null

/**
 * Enhanced Gemini AI Service for Emergency Incident Management
 *
 * Features:
 * - Advanced incident analysis with contextual recommendations
 * - Pattern detection for repeated incidents
 * - Confidence scoring and fallback handling
 * - Future scope: Predictive analytics and preventive actions
 */

// Emergency context and expertise knowledge base
const EMERGENCY_CONTEXT = `
You are an expert emergency response AI with extensive knowledge of:
- Fire safety protocols and evacuation procedures
- Medical emergency response and first aid
- Security incident management and threat assessment
- General emergency coordination and communication
- Risk assessment and priority determination
- Resource allocation and staff coordination

Your role is to provide accurate, actionable guidance for emergency situations.
`

/**
 * Enhanced prompt for comprehensive incident analysis
 * Returns structured JSON with type, priority, summary, and contextual recommendations
 */
const getAnalysisPrompt = (title, description) => `
${EMERGENCY_CONTEXT}

Analyze this emergency incident and provide a structured response.

INCIDENT DETAILS:
Title: ${title}
Description: ${description}

RESPONSE REQUIREMENTS:
1. Classify the incident type accurately (fire, medical, security, general, environmental, technical, etc.)
2. Determine priority based on urgency and potential risk (high, medium, low)
3. Provide a concise 1-2 sentence summary
4. Generate 3-5 specific, actionable recommendations based on:
   - Incident type and severity
   - Immediate safety concerns
   - Required response actions
   - Resource coordination needs

IMPORTANT: Recommendations should be:
- Specific and actionable (not generic)
- Prioritized by urgency
- Include who should perform each action
- Consider safety protocols
- Be appropriate for the incident type and priority

Return ONLY valid JSON in this exact format:
{
  "type": "incident_type",
  "priority": "high|medium|low",
  "summary": "brief summary",
  "recommendations": [
    "First priority action with responsible party",
    "Second priority action with responsible party",
    "Additional specific actions..."
  ],
  "confidence": 0.95
}
`

/**
 * Parse and validate Gemini AI response
 * Includes fallback handling for malformed responses
 */
const parseGeminiResponse = (responseText = '') => {
    try {
        // Clean the response text to extract JSON
        const cleanedText = responseText
            .replace(/```json\s*/g, '')
            .replace(/```\s*$/g, '')
            .replace(/^[^{]*/, '') // Remove any text before the first {
            .replace(/[^}]*$/, '') // Remove any text after the last }
            .trim()

        const parsed = JSON.parse(cleanedText)

        // Validate required fields and provide fallbacks
        return {
            type: String(parsed.type || 'general').trim().toLowerCase(),
            priority: validatePriority(parsed.priority),
            summary: String(parsed.summary || '').trim(),
            recommendations: Array.isArray(parsed.recommendations)
                ? parsed.recommendations.filter((recommendation) => recommendation && typeof recommendation === 'string').slice(0, 5)
                : getFallbackRecommendations(parsed.type || 'general'),
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
        }
    } catch (error) {
        console.warn('Failed to parse Gemini response:', error)
        console.warn('Raw response:', responseText)

        // Enhanced fallback with basic analysis from text
        return getFallbackAnalysis(responseText)
    }
}

/**
 * Validate and normalize priority values
 */
const validatePriority = (priority) => {
    const validPriorities = ['high', 'medium', 'low']
    const normalized = String(priority || 'medium').trim().toLowerCase()
    return validPriorities.includes(normalized) ? normalized : 'medium'
}

/**
 * Get fallback recommendations based on incident type
 */
const getFallbackRecommendations = (type) => {
    const fallbacks = {
        fire: [
            'Activate fire alarm and evacuate building immediately',
            'Contact fire department at emergency number',
            'Locate and prepare fire extinguishers if safe to do so'
        ],
        medical: [
            'Call emergency medical services immediately',
            'Provide basic first aid if trained and safe',
            'Clear area and ensure patient comfort'
        ],
        security: [
            'Alert security personnel immediately',
            'Secure the area and restrict access',
            'Document incident details for authorities'
        ],
        general: [
            'Assess situation for immediate safety concerns',
            'Notify appropriate emergency response team',
            'Document incident details and secure area'
        ]
    }

    return fallbacks[type] || fallbacks.general
}

/**
 * Extract basic analysis from raw text when JSON parsing fails
 */
const getFallbackAnalysis = (rawText) => {
    const text = String(rawText || '').toLowerCase()

    // Simple keyword-based classification
    let type = 'general'
    if (text.includes('fire') || text.includes('smoke') || text.includes('burn')) {
        type = 'fire'
    } else if (text.includes('medical') || text.includes('injury') || text.includes('ill')) {
        type = 'medical'
    } else if (text.includes('security') || text.includes('intruder') || text.includes('theft')) {
        type = 'security'
    }

    return {
        type,
        priority: 'medium',
        summary: rawText.substring(0, 100) + (rawText.length > 100 ? '...' : ''),
        recommendations: getFallbackRecommendations(type),
        confidence: 0.3
    }
}

/**
 * Enhanced incident analysis with comprehensive AI insights
 * @param {string} title - Incident title
 * @param {string} description - Incident description
 * @returns {Promise<Object>} Analysis results with type, priority, summary, recommendations, confidence
 */
export const analyzeIncident = async (title, description) => {
    try {
        if (!genAI) {
            console.warn('Gemini API key is not configured. Using fallback analysis.')
            return getFallbackAnalysis(`${title} ${description}`)
        }

        const model = genAI.getGenerativeModel({
            model: 'gemini-pro',
            generationConfig: {
                temperature: 0.3,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024
            }
        })

        const prompt = getAnalysisPrompt(title, description)
        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        const analysis = parseGeminiResponse(text)

        console.log('AI Incident Analysis:', {
            input: { title, description: description.substring(0, 100) + '...' },
            output: analysis
        })

        return analysis
    } catch (error) {
        console.error('Gemini AI analysis failed:', error)

        // Return fallback analysis instead of throwing
        return getFallbackAnalysis(`${title} ${description}`)
    }
}

/**
 * Pattern detection for repeated incidents
 * Analyzes incident history to identify recurring patterns
 * @param {Array} recentIncidents - Array of recent incidents from same location/type
 * @param {Object} currentIncident - Current incident being analyzed
 * @returns {Object} Pattern detection results
 */
export const detectIncidentPatterns = (recentIncidents = [], currentIncident = {}) => {
    if (!Array.isArray(recentIncidents) || recentIncidents.length === 0) {
        return {
            pattern_detected: false,
            frequency_score: 0,
            note: null
        }
    }

    const currentLocation = currentIncident.location || {}
    const currentType = currentIncident.type || 'general'

    // Filter incidents from same location and type within last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
    const relevantIncidents = recentIncidents.filter((incident) => {
        const incidentTime = incident.createdAt?.seconds
            ? incident.createdAt.seconds * 1000
            : new Date(incident.createdAt).getTime()

        const sameLocation = incident.location?.building === currentLocation.building &&
            incident.location?.floor === currentLocation.floor
        const sameType = incident.type === currentType

        return incidentTime > thirtyDaysAgo && sameLocation && sameType
    })

    const frequency = relevantIncidents.length

    // Pattern detection thresholds
    const PATTERN_THRESHOLDS = {
        high: 5,
        medium: 3,
        low: 1
    }

    let pattern_detected = false
    let frequency_score = 0
    let note = null

    if (frequency >= PATTERN_THRESHOLDS.high) {
        pattern_detected = true
        frequency_score = 3
        note = `High frequency pattern detected: ${frequency} similar incidents in this area within 30 days. Consider preventive measures.`
    } else if (frequency >= PATTERN_THRESHOLDS.medium) {
        pattern_detected = true
        frequency_score = 2
        note = `Recurring pattern detected: ${frequency} similar incidents in this area recently. Monitor closely.`
    } else if (frequency >= PATTERN_THRESHOLDS.low) {
        frequency_score = 1
        note = 'Similar incident occurred recently in this area.'
    }

    return {
        pattern_detected,
        frequency_score,
        note,
        relevant_incidents_count: frequency,
        analysis_period_days: 30
    }
}

/**
 * Future Scope: Predictive Analytics
 * TODO: Implement machine learning models to predict high-risk areas
 * TODO: Suggest preventive actions based on historical patterns
 * TODO: Integration with analytics dashboard for trend visualization
 *
 * Example future implementation:
 * export const predictHighRiskAreas = async (organizationId) => {
 *   // Analyze historical incident data
 *   // Use clustering algorithms to identify risk zones
 *   // Return preventive recommendations
 * }
 *
 * export const suggestPreventiveActions = async (patternData) => {
 *   // Based on detected patterns, suggest specific preventive measures
 *   // Integration with maintenance schedules, security protocols, etc.
 * }
 */
