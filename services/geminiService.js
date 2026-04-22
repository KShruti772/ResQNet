const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const parseGeminiResponse = (responseText = "") => {
    try {
        // Clean the response text to extract JSON
        const cleanedText = responseText
            .replace(/```json\s*/g, "")
            .replace(/```\s*$/g, "")
            .trim();

        const parsed = JSON.parse(cleanedText);

        return {
            type: String(parsed.type || "general").trim().toLowerCase(),
            priority: String(parsed.priority || "medium").trim().toLowerCase(),
            summary: String(parsed.summary || "").trim(),
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
        };
    } catch (error) {
        console.warn("Failed to parse Gemini response", error);
        // Fallback parsing - try to extract basic info from text
        return {
            type: "general",
            priority: "medium",
            summary: responseText.trim() || "",
            recommendations: []
        };
    }
};

export const analyzeIncident = async (description) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `Analyze this emergency description and return JSON:
{
  "type": "string (medical, fire, security, general, etc.)",
  "priority": "high | medium | low",
  "summary": "short sentence describing the incident",
  "recommendations": ["array of 2-3 immediate actions"]
}

Description: ${description}

Return ONLY JSON.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return parseGeminiResponse(text);
    } catch (error) {
        console.error("Gemini AI analysis failed:", error);
        throw error; // Let the caller handle fallback
    }
};
