import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, registerSuccessfulRequest } from '@/lib/rateLimit';
import { validateImagePayload } from '@/lib/validation';
import { solveMCQWithGemini } from '@/lib/gemini';
import { SolveApiResponse } from '@/lib/types';

export const maxDuration = 15;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse<SolveApiResponse>> {
  const routeStart = Date.now();
  try {
    // 1. Identify Client IP for Server-side Rate Limiting
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

    // 2. Check Server-Side Cooldown (30-second cooldown per client IP)
    const rateLimitCheck = checkRateLimit(clientIp);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: rateLimitCheck.error || 'Please wait before sending another question.',
          retryAfter: rateLimitCheck.retryAfter,
        },
        {
          status: 429,
          headers: rateLimitCheck.retryAfter
            ? { 'Retry-After': String(rateLimitCheck.retryAfter) }
            : undefined,
        }
      );
    }

    // 3. Parse & Validate Request Body
    const body = await req.json().catch(() => null);
    const validation = validateImagePayload(body);

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    // 4. Send Image to Gemini Vision Engine
    const { base64Data, mimeType } = validation.data;
    const result = await solveMCQWithGemini(base64Data, mimeType);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 422 }
      );
    }

    // 5. Register request in cooldown tracker upon success
    registerSuccessfulRequest(clientIp);

    const totalBackendMs = Date.now() - routeStart;
    console.log(`[PERF BACKEND] Total backend API route execution time: ${totalBackendMs}ms (Gemini: ${result.geminiTimeMs}ms)`);

    // 6. Return Structured Answer
    return NextResponse.json({
      success: true,
      ...result.data,
      serverTimeMs: totalBackendMs,
      geminiTimeMs: result.geminiTimeMs,
    });
  } catch (err: unknown) {
    console.error('[API Route Exception /api/solve]', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to solve this question right now. Please try again later.',
      },
      { status: 500 }
    );
  }
}

// Block non-POST requests cleanly
export async function GET(): Promise<NextResponse<SolveApiResponse>> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed. Only POST is supported.' },
    { status: 405 }
  );
}
