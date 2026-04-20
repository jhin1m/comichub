import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

@Injectable()
export class TurnstileGuard implements CanActivate {
  private readonly logger = new Logger(TurnstileGuard.name);

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const secretKey = this.configService.get<string>(
      'turnstile.secretKey',
      '',
    );
    if (!secretKey) return true; // Dev bypass — no key configured

    const request = context.switchToHttp().getRequest();
    const token = request.body?.turnstileToken;

    if (!token) {
      throw new ForbiddenException('Turnstile token required');
    }

    try {
      const res = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: secretKey,
          response: token,
          remoteip: request.ip,
        }),
        signal: AbortSignal.timeout(5000),
      });

      const result = (await res.json()) as { success: boolean };

      if (!result.success) {
        throw new ForbiddenException('Turnstile verification failed');
      }
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      // H4: fail-closed in prod — CF outage is NOT a valid auth bypass.
      // Dev/non-prod falls open so local work isn't blocked by transient network issues.
      const isProd =
        this.configService.get<string>('app.nodeEnv') === 'production';
      if (isProd) {
        this.logger.error('Turnstile verification errored in prod', err);
        throw new ForbiddenException('Turnstile verification failed');
      }
      this.logger.warn('Turnstile verification failed, allowing request', err);
    }

    return true;
  }
}
