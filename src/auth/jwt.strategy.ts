import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  scope?: string;
  scopes?: string[];
  [key: string]: any;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'habitat_ec_secret_key_2026',
    });
  }

  async validate(payload: JwtPayload) {
    const { sub, scope, scopes, ...rest } = payload;
    return {
      sub,
      ownerId: sub,
      scopes: scopes || (scope ? scope.split(' ') : []),
      ...rest,
    };
  }
}
