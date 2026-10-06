import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  generateTestToken(sub = 'user-admin-123', scope = 'alojamientos:read alojamientos:book') {
    const payload = {
      sub,
      scope,
      scopes: scope.split(' '),
      email: 'admin@habitat.ec',
    };

    return {
      access_token: this.jwtService.sign(payload),
      token_type: 'Bearer',
      expires_in: 3600,
      scope,
      user: {
        id: sub,
        scope,
      },
    };
  }
}

