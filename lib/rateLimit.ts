/**
 * In-Memory Server-Side Cooldown Limiter.
 * 
 * Enforces:
 * 1. 30-second per-IP cooldown between requests.
 * 
 * Modular design allowing easy replacement with Redis / Upstash if needed for multi-instance serverless deployments.
 */

interface ClientRecord {
  lastRequestTimestamp: number;
}

const clientStore = new Map<string, ClientRecord>();

export interface RateLimitCheckResult {
  allowed: boolean;
  error?: string;
  retryAfter?: number;
}

export function checkRateLimit(clientIp: string): RateLimitCheckResult {
  const cooldownSeconds = parseInt(process.env.COOLDOWN_SECONDS || '30', 10);
  const now = Date.now();

  // Check 30-Second Cooldown per IP/Client
  const clientRecord = clientStore.get(clientIp);
  if (clientRecord) {
    const elapsedMs = now - clientRecord.lastRequestTimestamp;
    const cooldownMs = cooldownSeconds * 1000;

    if (elapsedMs < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
      return {
        allowed: false,
        error: `Please wait ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''} before sending another question.`,
        retryAfter: remainingSeconds,
      };
    }
  }

  return { allowed: true };
}

export function registerSuccessfulRequest(clientIp: string): void {
  const now = Date.now();
  clientStore.set(clientIp, {
    lastRequestTimestamp: now,
  });
}
