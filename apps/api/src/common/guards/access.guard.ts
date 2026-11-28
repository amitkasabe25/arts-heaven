import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '@prisma/client';
import { PERMISSIONS_KEY, ROLES_KEY } from '../decorators/access.decorator';
import { AuthUser } from '../decorators/current-user.decorator';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const permissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if ((!roles || roles.length === 0) && (!permissions || permissions.length === 0)) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user) throw new ForbiddenException('Authentication required');

    if (roles?.length && !roles.some((role) => user.roles.includes(role))) {
      throw new ForbiddenException('You do not have the required role');
    }
    if (
      permissions?.length &&
      !user.permissions.includes('*') &&
      !permissions.every((permission) => user.permissions.includes(permission))
    ) {
      throw new ForbiddenException('You do not have the required permission');
    }
    return true;
  }
}
