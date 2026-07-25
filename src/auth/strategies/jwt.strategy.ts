import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AppConfigService } from '../../config';
import type {
  EstadoAcceso,
  NivelAcceso,
} from '../../users/schemas/user.schema';

export interface JwtPayload {
  sub: string;
  accessStatus?: EstadoAcceso;
  accessLevel?: NivelAcceso;
}

export interface AuthUser {
  userId: string;
  accessStatus?: EstadoAcceso;
  accessLevel?: NivelAcceso;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(ConfigService) config: AppConfigService) {
    const secret = config.get('JWT_SECRET', { infer: true });
    if (!secret) {
      throw new Error(
        'JWT_SECRET no está configurado: la autenticación no puede operar',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): AuthUser {
    return {
      userId: payload.sub,
      accessStatus: payload.accessStatus,
      accessLevel: payload.accessLevel,
    };
  }
}
