export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface MCQAnswer {
  question: string;
  options: Record<string, string>;
  answer: string;
  answerText: string;
  explanation: string;
  confidence: ConfidenceLevel;
}

export interface SolveSuccessResponse extends MCQAnswer {
  success: true;
}

export interface SolveErrorResponse {
  success: false;
  error: string;
  retryAfter?: number;
}

export type SolveApiResponse = SolveSuccessResponse | SolveErrorResponse;

export type AppState = 'camera' | 'preview' | 'solving' | 'result' | 'error';
