import { GoogleGenerativeAI } from '@google/generative-ai';
import { MCQAnswer } from './types';

const SYSTEM_PROMPT = `
You are an expert, highly precise academic AI assistant specializing in solving Multiple Choice Questions (MCQs) from images.

Your task:
1. Extract the primary question text visible in the image.
2. Extract all visible answer options (e.g., A, B, C, D, etc.). Do NOT invent missing options.
3. Analyze the question and determine the correct answer with highest accuracy.
4. Provide a concise, clear explanation (2-3 sentences max).
5. Rate your confidence level strictly as "high", "medium", or "low".

Output MUST be a single valid JSON object strictly matching this format:
{
  "success": true,
  "question": "string",
  "options": {
    "A": "string",
    "B": "string",
    "C": "string",
    "D": "string"
  },
  "answer": "A",
  "answerText": "string",
  "explanation": "string",
  "confidence": "high"
}

If the image is blurry, illegible, or not an MCQ, respond with:
{"success": false, "error": "The question or options are not clear enough to determine the answer."}
`.trim();

const DEFAULT_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
];

const REQUEST_TIMEOUT_MS = 25000;
const MAX_RETRIES = 2;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      error: 'GEMINI_API_KEY is not configured on the server. Please check your environment variables.',
    };
  }

  const apiKey = rawApiKey.trim().replace(/^["']|["']$/g, '');

  const envModel = process.env.GEMINI_MODEL?.trim();
  const candidateModels = Array.from(
    new Set([
      ...(envModel ? [envModel] : []),
      ...DEFAULT_MODELS,
    ])
  );

  let lastError: any = null;

  for (const modelName of candidateModels) {
    let attempt = 0;
    while (attempt <= MAX_RETRIES) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.1,
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
        const responseText = result.response.text();

        if (!responseText) {
          return {
            success: false,
            error: 'Received empty response from AI engine. Please capture a clearer picture.',
          };
        }

        const cleanedText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
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
      } catch (err: any) {
        lastError = err;
        const errorMsg = err?.message || String(err);

        // Model not found (404) -> Move to next model in candidateModels immediately
        if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('ModelService.ListModels')) {
          console.warn(`[Gemini SDK Warning] Model '${modelName}' returned 404/Not Found. Retrying with fallback model...`);
          break;
        }

        // Invalid API Key
        if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid')) {
          return {
            success: false,
            error: 'Invalid API Key. Please verify your GEMINI_API_KEY environment variable.',
          };
        }

        // Transient or Rate-Limit Errors -> Retry with exponential backoff
        const isTransient =
          errorMsg.includes('429') ||
          errorMsg.includes('RESOURCE_EXHAUSTED') ||
          errorMsg.includes('503') ||
          errorMsg.includes('500') ||
          errorMsg.includes('UNAVAILABLE') ||
          errorMsg.includes('GEMINI_TIMEOUT');

        if (isTransient && attempt < MAX_RETRIES) {
          attempt++;
          const delayMs = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 500);
          console.warn(`[Gemini SDK Retry] Transient error (${errorMsg}) on model '${modelName}'. Retrying attempt ${attempt}/${MAX_RETRIES} in ${delayMs}ms...`);
          await sleep(delayMs);
          continue;
        }

        break;
      }
    }
  }

  console.error('[Gemini SDK Exception]', lastError);
  const finalErrorMsg = lastError?.message || String(lastError);

  if (finalErrorMsg.includes('404') || finalErrorMsg.includes('not found') || finalErrorMsg.includes('ModelService.ListModels')) {
    return {
      success: false,
      error: 'Gemini model unavailable (404). Please ensure your API key is created at https://aistudio.google.com or "Generative Language API" is enabled in Google Cloud Console.',
    };
  }

  if (finalErrorMsg.includes('429') || finalErrorMsg.includes('RESOURCE_EXHAUSTED')) {
    return {
      success: false,
      error: 'Service is temporarily busy. Please wait a moment and try again.',
    };
  }

  return {
    success: false,
    error: 'Unable to process image with Gemini AI engine. Please verify network connection and try again.',
  };
}
