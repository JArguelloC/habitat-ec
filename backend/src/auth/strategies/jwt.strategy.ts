import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  correo: string;
  roles: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'HabitatEC_SuperSecretKey_2026!',
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.roles) {
      throw new UnauthorizedException('Token de sesión no válido.');
    }
    return {
      usuarioId: payload.sub,
      correo: payload.correo,
      roles: payload.roles,
    };
  }
}