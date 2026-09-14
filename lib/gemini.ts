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
  const modelName = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent([
      SYSTEM_PROMPT,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ]);

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
    console.error('[Gemini SDK Exception]', err);
    const errorMsg = err?.message || String(err);

    if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid')) {
      return {
        success: false,
        error: 'Google API Key Error: API_KEY_INVALID. Please create a new free key at https://aistudio.google.com and update Vercel.',
      };
    }

    return {
      success: false,
      error: `Gemini SDK Error: ${errorMsg}`,
    };
  }
}
