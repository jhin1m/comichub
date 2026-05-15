import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { stripHtml } from '../utils/strip-html.util.js';

export type ModerationStatus = 'approved' | 'flagged' | 'rejected';

export interface ModerationResult {
  status: ModerationStatus;
  score: Record<string, number> | null;
  reason?: 'moderation_disabled' | 'api_error' | 'empty_content';
}

const TIMEOUT_MS = 5_000;
const REJECT_THRESHOLD = 0.85;
const FLAG_THRESHOLD = 0.4;
const OPENAI_URL = 'https://api.openai.com/v1/moderations';
const MODEL = 'omni-moderation-latest';

interface OpenAIModerationResponse {
  results: Array<{
    category_scores: Record<string, number>;
  }>;
}

/**
 * OpenAI Moderation wrapper with graceful fallback:
 *  - No API key       → always `approved` (logged once at boot)
 *  - API error        → `approved` (fail-soft, never blocks user)
 *  - Timeout          → `approved`
 *  - Score > 0.85     → `rejected`
 *  - Score 0.4..0.85  → `flagged`
 *  - Score < 0.4      → `approved`
 */
@Injectable()
export class ModerationService implements OnModuleInit {
  private readonly logger = new Logger(ModerationService.name);
  private apiKey: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const key = this.config.get<string>('OPENAI_API_KEY')?.trim() ?? '';
    if (!key) {
      this.logger.warn(
        'OPENAI_API_KEY not set — comment moderation disabled, comments auto-approved.',
      );
      return;
    }
    this.apiKey = key;
  }

  /** Is the service connected to OpenAI? Affects initial moderationStatus on insert. */
  isEnabled(): boolean {
    return this.apiKey !== null;
  }

  async moderate(content: string): Promise<ModerationResult> {
    if (!this.apiKey) {
      return { status: 'approved', score: null, reason: 'moderation_disabled' };
    }
    const text = stripHtml(content);
    if (text.length < 1) {
      return { status: 'approved', score: null, reason: 'empty_content' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: MODEL, input: text }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(
          `Moderation API ${res.status}, defaulting to approved.`,
        );
        return { status: 'approved', score: null, reason: 'api_error' };
      }
      const data = (await res.json()) as OpenAIModerationResponse;
      const scores = data.results?.[0]?.category_scores ?? null;
      if (!scores) return { status: 'approved', score: null };
      const maxScore = Math.max(...Object.values(scores));
      if (maxScore > REJECT_THRESHOLD) {
        return { status: 'rejected', score: scores };
      }
      if (maxScore > FLAG_THRESHOLD)
        return { status: 'flagged', score: scores };
      return { status: 'approved', score: scores };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Moderation API failed: ${msg} — defaulting to approved.`,
      );
      return { status: 'approved', score: null, reason: 'api_error' };
    } finally {
      clearTimeout(timer);
    }
  }
}
