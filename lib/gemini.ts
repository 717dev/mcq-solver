import { GoogleGenerativeAI } from '@google/generative-ai';
import { MCQAnswer } from './types';

const SYSTEM_PROMPT = `
You are a ultra-fast academic MCQ solver. Read the image and determine the correct answer.

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

const DEFAULT_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash-001',
  'gemini-1.5-flash-002',
  'gemini-2.0-flash-exp',
];

const REQUEST_TIMEOUT_MS = 25000;
const MAX_RETRIES = 2;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Dynamically queries Google Generative Language API to list models
 * supported for generateContent with the user's specific API key.
 */
async function fetchAvailableModels(apiKey: string): Promise<{ models: string[]; apiError?: string }> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();

    if (!res.ok) {
      const googleErrMsg = data?.error?.message || `HTTP ${res.status}`;
      console.warn(`[Gemini ListModels Warning] Google API returned ${res.status}: ${googleErrMsg}`);
      return { models: [], apiError: googleErrMsg };
    }

    if (Array.isArray(data?.models)) {
      const validModels = data.models
        .filter((m: any) =>
          Array.isArray(m.supportedGenerationMethods) &&
          m.supportedGenerationMethods.includes('generateContent')
        )
        .map((m: any) => m.name.replace(/^models\//, ''));

      console.log(`[Gemini ListModels] Discovered ${validModels.length} models for API key:`, validModels);
      return { models: validModels };
    }
  } catch (err) {
    console.warn('[Gemini ListModels Exception]', err);
  }
  return { models: [] };
}

export async function solveMCQWithGemini(
  base64Image: string,
  mimeType: string
): Promise<{ success: true; data: MCQAnswer; geminiTimeMs: number } | { success: false; error: string }> {
  const rawApiKey = process.env.GEMINI_API_KEY;

  if (!rawApiKey || rawApiKey.trim() === '') {
    console.error('[Gemini Integration Error] GEMINI_API_KEY environment variable is empty or missing.');
    return {
      success: false,
      error: 'Gemini API authentication failed. GEMINI_API_KEY is not configured on server.',
    };
  }

  const apiKey = rawApiKey.trim().replace(/^["']|["']$/g, '');

  const envModel = process.env.GEMINI_MODEL?.trim();
  let candidateModels = Array.from(
    new Set([
      ...(envModel ? [envModel] : []),
      ...DEFAULT_MODELS,
    ])
  );

  let lastError: any = null;
  let hasTriedDynamicDiscovery = false;

  for (let i = 0; i < candidateModels.length; i++) {
    const modelName = candidateModels[i];
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
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

        // Invalid API Key
        if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid')) {
          return {
            success: false,
            error: 'Gemini API authentication failed.',
          };
        }

        // 404 / Model Not Found -> Try dynamic model discovery if not yet done
        if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('ModelService.ListModels')) {
          console.warn(`[Gemini SDK Warning] Model '${modelName}' returned 404/Not Found.`);

          if (!hasTriedDynamicDiscovery) {
            hasTriedDynamicDiscovery = true;
            console.log('[Gemini SDK] Performing dynamic model discovery via ListModels API...');
            const { models: discoveredModels, apiError } = await fetchAvailableModels(apiKey);

            if (apiError && (apiError.includes('API key') || apiError.includes('disabled'))) {
              return {
                success: false,
                error: `Gemini API authentication failed: ${apiError}`,
              };
            }

            if (discoveredModels.length > 0) {
              const newModels = discoveredModels.filter((m) => !candidateModels.includes(m));
              if (newModels.length > 0) {
                console.log(`[Gemini SDK] Adding ${newModels.length} newly discovered models to candidates:`, newModels);
                candidateModels.push(...newModels);
              }
            }
          }

          break; // Break inner retry loop for this model, move to next model in candidateModels
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
      error: 'Configured Gemini model is unavailable. Please verify GEMINI_MODEL and Gemini API access.',
    };
  }

  if (finalErrorMsg.includes('429') || finalErrorMsg.includes('RESOURCE_EXHAUSTED')) {
    return {
      success: false,
      error: 'Too many requests. Retrying shortly...',
    };
  }

  return {
    success: false,
    error: 'Could not read the image. Please capture the MCQ again.',
  };
}
