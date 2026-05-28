import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'oddix_secret_2026',
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.userId || payload.sub,
      email: payload.email,
      role: payload.role,
      plan: payload.plan,
    };
  }
}