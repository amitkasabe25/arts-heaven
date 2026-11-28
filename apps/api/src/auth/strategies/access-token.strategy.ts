import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Env } from '../../common/config/env.validation';
import { UsersService } from '../../users/users.service';
import { TokenService } from '../token.service';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<Env, true>,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  async validate(payload: { sub: string }): Promise<AuthUser> {
    // Roles and permissions are re-read from the database on every request so
    // privilege changes and deactivations take effect immediately.
    const user = await this.users.findWithAccess(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException('Account is not active');
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map((role) => role.name),
      permissions: [...new Set(user.roles.flatMap((role) => role.permissions.map((p) => p.key)))],
    };
  }
}
