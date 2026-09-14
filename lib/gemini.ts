import { MCQAnswer } from './types';

const SYSTEM_PROMPT = `
You are an expert, highly precise academic AI assistant specializing in solving Multiple Choice Questions (MCQs) from images.

Your task:
1. Extract the primary question text visible in the image.
2. Extract all visible answer options (e.g., A, B, C, D, etc.). Do NOT invent missing options.
3. Analyze the question and determine the correct answer with highest accuracy.
4. Provide a concise, clear explanation (2-3 sentences max).
5. Rate your confidence level strictly as "high", "medium", or "low".

Rules:
- If the image does not contain a readable MCQ question or options are missing/blurry/illegible, respond with:
  {"success": false, "error": "The question or options are not clear enough to determine the answer."}
- If multiple MCQs appear in the image, process only the main/first visible question.
- Always output valid JSON strictly matching the specified JSON schema.
`.trim();

const JSON_SCHEMA = {
  type: "OBJECT",
  properties: {
    success: { type: "BOOLEAN" },
    error: { type: "STRING", description: "Reason why question could not be solved if success is false" },
    question: { type: "STRING", description: "The full question text extracted from the image" },
    options: {
      type: "OBJECT",
      description: "Key-value pairs of option letters to option text, e.g. A, B, C, D",
      properties: {
        A: { type: "STRING" },
        B: { type: "STRING" },
        C: { type: "STRING" },
        D: { type: "STRING" },
        E: { type: "STRING" }
      }
    },
    answer: { type: "STRING", description: "The letter of the correct option, e.g., 'A', 'B', 'C', or 'D'" },
    answerText: { type: "STRING", description: "The exact text of the correct option" },
    explanation: { type: "STRING", description: "Short explanation for why this answer is correct" },
    confidence: { type: "STRING", description: "high, medium, or low" }
  },
  required: ["success"]
};

/**
 * Dynamically queries Google ModelService to discover available models for the given API Key
 */
async function discoverAvailableModel(apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) return null;

    const data = await res.json();
    const models: Array<{ name: string; supportedGenerationMethods?: string[] }> = data?.models || [];

    // Filter models supporting generateContent
    const validModels = models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));

    if (validModels.length === 0) return null;

    // Prefer flash models, then pro models, then any valid model
    const flashModel = validModels.find((m) => m.includes('flash'));
    if (flashModel) return flashModel;

    const proModel = validModels.find((m) => m.includes('pro'));
    if (proModel) return proModel;

    return validModels[0];
  } catch {
    return null;
  }
}

export async function solveMCQWithGemini(
  base64Image: string,
  mimeType: string
): Promise<{ success: true; data: MCQAnswer } | { success: false; error: string }> {
  const rawApiKey = process.env.GEMINI_API_KEY;

  if (!rawApiKey || rawApiKey.trim() === '') {
    console.error('[Gemini Integration Error] GEMINI_API_KEY environment variable is empty or missing.');
    return {
      success: false,
      error: 'GEMINI_API_KEY is missing on server. Please add GEMINI_API_KEY in Vercel Environment Variables and Redeploy.',
    };
  }

  // Clean API key (remove quotes, whitespace)
  const apiKey = rawApiKey.trim().replace(/^["']|["']$/g, '');

  let selectedModel = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';

  const generateWithModel = async (modelName: string) => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1000,
        response_mime_type: "application/json",
        response_schema: JSON_SCHEMA,
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    return { response, modelName };
  };

  try {
    let { response, modelName } = await generateWithModel(selectedModel);

    // If 404 model not found, perform dynamic model discovery using Google ModelService
    if (response.status === 404) {
      console.warn(`[Gemini API] Model ${selectedModel} returned 404. Attempting dynamic model discovery...`);
      const discoveredModel = await discoverAvailableModel(apiKey);

      if (discoveredModel && discoveredModel !== selectedModel) {
        console.log(`[Gemini API] Discovered available model for API key: ${discoveredModel}`);
        const retryResult = await generateWithModel(discoveredModel);
        response = retryResult.response;
        modelName = retryResult.modelName;
      }
    }

    if (!response.ok) {
      const errorJson = await response.json().catch(() => null);
      const errorMsg = errorJson?.error?.message || (await response.text().catch(() => ''));
      console.error(`[Gemini API Error - ${modelName}] HTTP ${response.status}:`, errorMsg);

      if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid')) {
        return {
          success: false,
          error: `Google API Key Error: API_KEY_INVALID. Your GEMINI_API_KEY is invalid. Please generate a new key from https://aistudio.google.com and update Vercel.`,
        };
      }

      return {
        success: false,
        error: `[Google API ${response.status}] ${errorMsg || response.statusText}`,
      };
    }

    const responseData = await response.json();
    const candidateText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return {
        success: false,
        error: 'Received empty response from AI engine. Please capture a clearer picture.',
      };
    }

    // Clean JSON markdown wrapper if present
    const cleanedText = candidateText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleanedText);

    if (parsed.success === false || parsed.error) {
      return {
        success: false,
        error: parsed.error || 'The question or options are not clear enough to determine the answer.',
      };
    }

    if (!parsed.answer || !parsed.question) {
      return {
        success: false,
        error: 'Please capture a clear image containing one MCQ with question and options.',
      };
    }

    const confidence: 'high' | 'medium' | 'low' = ['high', 'medium', 'low'].includes(parsed.confidence)
      ? parsed.confidence
      : 'medium';

    return {
      success: true,
      data: {
        question: parsed.question || 'Question text unavailable',
        options: parsed.options || {},
        answer: String(parsed.answer).toUpperCase(),
        answerText: parsed.answerText || (parsed.options ? parsed.options[parsed.answer] : '') || '',
        explanation: parsed.explanation || 'No explanation provided.',
        confidence,
      },
    };
  } catch (err: unknown) {
    console.error(`[Gemini Exception]`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error connecting to Gemini API.',
    };
  }
}
