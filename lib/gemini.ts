import { GoogleGenerativeAI } from '@google/generative-ai';
import { MCQAnswer } from './types';

const SYSTEM_PROMPT = `
You are an ultra-fast academic MCQ solver. Read the image and determine the correct answer.

Output MUST be a single valid JSON object in this exact format:
{
  "question": "string",
  "options": {
    "A": "string",
    "B": "string",
    "C": "string",
    "D": "string"
  },
  "answer": "A",
  "answerText": "string",
  "explanation": "One concise sentence explanation.",
  "confidence": "high"
}

If the image is unreadable or not an MCQ:
{"error": "Could not read the image. Please capture the MCQ again."}
`.trim();

// Fast production models in priority order
const DEFAULT_MODELS = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
];

const REQUEST_TIMEOUT_MS = 14000; // 14 seconds max per single attempt

export async function solveMCQWithGemini(
  base64Image: string,
  mimeType: string,
  customApiKey?: string
): Promise<{ success: true; data: MCQAnswer; geminiTimeMs: number } | { success: false; error: string }> {
  const rawApiKey = customApiKey || process.env.GEMINI_API_KEY;

  if (!rawApiKey || rawApiKey.trim() === '') {
    console.error('[Gemini API Error] GEMINI_API_KEY environment variable is empty or missing.');
    return {
      success: false,
      error: 'Gemini API key is not configured. Please click the Key button in the top header to enter your API key.',
    };
  }

  const apiKey = rawApiKey.trim().replace(/^["']|["']$/g, '');
  const envModel = process.env.GEMINI_MODEL?.trim();

  // Deduplicated candidate models list
  const candidateModels = Array.from(
    new Set([
      ...(envModel && envModel !== 'gemini-3.6-flash-high' ? [envModel] : []),
      ...DEFAULT_MODELS,
    ])
  );

  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      const geminiStart = Date.now();
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 300,
          responseMimeType: 'application/json',
        },
      });

      const generatePromise = model.generateContent([
        SYSTEM_PROMPT,
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType,
          },
        },
      ]);

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), REQUEST_TIMEOUT_MS)
      );

      const result = await Promise.race([generatePromise, timeoutPromise]);
      const geminiTimeMs = Date.now() - geminiStart;
      console.log(`[PERF BACKEND] Gemini generateContent execution time: ${geminiTimeMs}ms (model: ${modelName})`);

      const responseText = result.response.text();

      if (!responseText) {
        return {
          success: false,
          error: 'Could not read the image. Please capture the MCQ again.',
        };
      }

      const cleanedText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleanedText);

      if (parsed.success === false || parsed.error) {
        return {
          success: false,
          error: parsed.error || 'Could not read the image. Please capture the MCQ again.',
        };
      }

      if (!parsed.answer || !parsed.question) {
        return {
          success: false,
          error: 'Could not read the image. Please capture the MCQ again.',
        };
      }

      const confidence: 'high' | 'medium' | 'low' = ['high', 'medium', 'low'].includes(parsed.confidence)
        ? parsed.confidence
        : 'medium';

      return {
        success: true,
        geminiTimeMs,
        data: {
          question: parsed.question || 'Question text unavailable',
          options: parsed.options || {},
          answer: String(parsed.answer).toUpperCase(),
          answerText: parsed.answerText || (parsed.options ? parsed.options[parsed.answer] : '') || '',
          explanation: parsed.explanation || 'No explanation provided.',
          confidence,
        },
      };
    } catch (err: any) {
      lastError = err;
      const errorMsg = err?.message || String(err);
      console.warn(`[Gemini SDK Attempt Failed] Model '${modelName}' error: ${errorMsg}`);

      // Invalid API key fails immediately without trying other models
      if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid')) {
        return {
          success: false,
          error: 'Invalid Gemini API Key. Please check your key in the header and try again.',
        };
      }

      // 404, 503, Timeout, or Overloaded -> Continue immediately to next candidate model
      continue;
    }
  }

  console.error('[Gemini SDK All Models Exhausted]', lastError);
  const finalErrorMsg = lastError?.message || String(lastError);

  if (finalErrorMsg.includes('503') || finalErrorMsg.includes('UNAVAILABLE') || finalErrorMsg.includes('No capacity available')) {
    return {
      success: false,
      error: 'Gemini AI server is currently overloaded (503). Please try again in a few seconds.',
    };
  }

  if (finalErrorMsg.includes('429') || finalErrorMsg.includes('RESOURCE_EXHAUSTED')) {
    return {
      success: false,
      error: 'API rate limit reached. Please wait a moment before trying again.',
    };
  }

  if (finalErrorMsg.includes('GEMINI_TIMEOUT')) {
    return {
      success: false,
      error: 'Request timed out waiting for AI response. Please try again with a clearer photo.',
    };
  }

  return {
    success: false,
    error: 'Could not process the image right now. Please try again.',
  };
}
