import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class B2bThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const apiKey =
      req.headers['x-api-key'] ||
      req.headers['x-b2b-key'] ||
      (typeof req.headers['authorization'] === 'string' &&
      req.headers['authorization'].startsWith('ApiKey ')
        ? req.headers['authorization'].replace(/^ApiKey\s+/i, '').trim()
        : null);

    const validKey =
      process.env.API_KEY || 'hab_b2b_live_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c';

    // Eximir del Rate Limit si la petición proviene del validador de Booking con su API Key válida
    if (apiKey === validKey) {
      return true;
    }

    return false;
  }
}

