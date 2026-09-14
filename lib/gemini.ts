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
    confidence: { type: "STRING", enum: ["high", "medium", "low"] }
  },
  required: ["success"]
};

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

  // Models to try in order
  const userModel = process.env.GEMINI_MODEL ? process.env.GEMINI_MODEL.trim() : null;
  const modelsToTry = userModel
    ? [userModel, 'gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-2.0-flash-exp']
    : ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-2.0-flash-exp'];

  let lastGoogleErrorMessage = '';

  for (const modelName of modelsToTry) {
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

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        const errorMsg = errorJson?.error?.message || (await response.text().catch(() => ''));
        lastGoogleErrorMessage = `[Google API ${response.status}] ${errorMsg || response.statusText}`;

        console.error(`[Gemini API Model Error - ${modelName}] HTTP ${response.status}:`, errorMsg);

        // If key itself is invalid (API_KEY_INVALID), trying other models won't help
        if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid')) {
          return {
            success: false,
            error: `Google API Key Error: API_KEY_INVALID. Your GEMINI_API_KEY is incorrect or inactive. Please generate a new key from https://aistudio.google.com and update Vercel.`,
          };
        }

        // Try next model if 404 model not found
        continue;
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
      console.error(`[Gemini Exception - ${modelName}]`, err);
      lastGoogleErrorMessage = err instanceof Error ? err.message : 'Network error';
    }
  }

  return {
    success: false,
    error: lastGoogleErrorMessage || 'Unable to connect to Google Gemini API. Please verify your GEMINI_API_KEY in Vercel.',
  };
}
