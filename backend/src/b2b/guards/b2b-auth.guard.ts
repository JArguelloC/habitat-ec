import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_B2B_KEY } from '../decorators/public-b2b.decorator.js';

export const DEFAULT_B2B_API_KEY =
  'hab_b2b_live_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c';

@Injectable()
export class B2bAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_B2B_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const expectedApiKey =
      this.configService.get<string>('API_KEY') ||
      process.env.API_KEY ||
      DEFAULT_B2B_API_KEY;

    // 1. Validar cabecera X-API-Key (case-insensitive en Express)
    const rawApiKey =
      request.headers['x-api-key'] ||
      request.headers['X-API-Key'] ||
      request.query?.api_key;

    if (rawApiKey && String(rawApiKey).trim() === expectedApiKey.trim()) {
      request.b2bClient = {
        authMethod: 'API_KEY',
        nodeId:
          this.configService.get<string>('NODE_ID') ||
          process.env.NODE_ID ||
          'NODE_ALO_HAB',
      };
      return true;
    }

    // 2. Validar Token Bearer OAuth2 / JWT
    const authHeader = request.headers['authorization'];
    if (
      typeof authHeader === 'string' &&
      authHeader.toLowerCase().startsWith('bearer ')
    ) {
      const token = authHeader.slice(7).trim();
      if (token === expectedApiKey.trim()) {
        request.b2bClient = {
          authMethod: 'BEARER_API_KEY',
          nodeId: 'NODE_ALO_HAB',
        };
        return true;
      }

      try {
        const secret =
          this.configService.get<string>('JWT_SECRET') ||
          process.env.JWT_SECRET ||
          'habitat-ec-secret-2026';
        const payload = await this.jwtService.verifyAsync(token, { secret });
        request.user = payload;
        request.b2bClient = {
          authMethod: 'OAUTH2_JWT',
          sub: payload.sub || payload.usuarioId,
        };
        return true;
      } catch {
        throw new UnauthorizedException(
          'Token Bearer OAuth2 inválido o expirado para el contrato B2B.',
        );
      }
    }

    throw new UnauthorizedException(
      'Acceso B2B denegado: Se requiere cabecera X-API-Key válida o Token Bearer OAuth2.',
    );
  }
}
