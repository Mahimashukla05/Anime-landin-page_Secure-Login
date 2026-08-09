const { GoogleGenAI } = require('@google/genai');

/**
 * Generate AI Personalization Explanations for Top Candidate Recommendations
 */
async function generateAIPersonalization(userPreferences = null, topCandidates = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !topCandidates.length) {
    return null; // Graceful fallback if no API key or no candidates
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Format compact candidates list (limit to top 3 for optimal token efficiency)
    const compactCandidates = topCandidates.slice(0, 3).map(c => ({
      animeId: (c._id || c.malId).toString(),
      title: c.title,
      genres: c.genres || [],
      score: c.score || 0,
      deterministicReason: c.explanation ? c.explanation.primaryReason : 'Recommended match'
    }));

    // Format user context
    const userContext = {
      favoriteAnime: (userPreferences && userPreferences.favoriteAnimeIds) || [],
      preferredGenres: (userPreferences && userPreferences.preferredGenres) || [],
      preferredMood: (userPreferences && userPreferences.preferredMoods) || []
    };

    const prompt = `
You are an expert anime personalization assistant for DemoReco V2.
Your task is to craft 1 concise, engaging sentence for each candidate anime explaining why it fits the user's taste.

USER CONTEXT:
${JSON.stringify(userContext)}

CANDIDATES (Top recommendations selected by backend scoring engine):
${JSON.stringify(compactCandidates)}

CRITICAL CONSTRAINTS:
1. ONLY write explanations for the candidates listed above.
2. NEVER introduce, invent, or mention any anime outside the provided candidate list.
3. Do NOT change the candidate ordering.
4. Output MUST be valid JSON with the exact schema below.

JSON RESPONSE SCHEMA:
{
  "intro": "Short 1-sentence friendly greeting referencing their preferences",
  "explanations": [
    {
      "animeId": "MUST match candidate animeId exactly",
      "reason": "1-sentence personalized explanation"
    }
  ]
}
`;

    // Timeout promise (3.0 seconds max latency ceiling)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI API request timed out (3.0s ceiling exceeded)')), 3000);
    });

    const apiPromise = ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const response = await Promise.race([apiPromise, timeoutPromise]);
    const responseText = response.text || (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts[0].text);

    if (!responseText) {
      console.warn('[AI Personalization] Empty response text from Gemini API.');
      return null;
    }

    const parsedJson = JSON.parse(responseText);

    // Validate structured JSON response
    if (!parsedJson || !Array.isArray(parsedJson.explanations)) {
      console.warn('[AI Personalization] Invalid JSON structure returned by Gemini API.');
      return null;
    }

    // Sanitize and map AI explanations back to candidate list
    const candidateIdSet = new Set(compactCandidates.map(c => c.animeId));
    const validExplanationsMap = new Map();

    parsedJson.explanations.forEach(exp => {
      if (exp && exp.animeId && candidateIdSet.has(exp.animeId.toString()) && exp.reason) {
        validExplanationsMap.set(exp.animeId.toString(), exp.reason);
      }
    });

    return {
      intro: parsedJson.intro || 'Personalized recommendations tailored to your taste:',
      explanationsMap: validExplanationsMap
    };

  } catch (error) {
    console.warn(`[AI Personalization Warning] Gemini API unavailable (${error.message}). Falling back to deterministic scoring explanations.`);
    return null; // Trigger graceful fallback
  }
}

module.exports = {
  generateAIPersonalization
};
