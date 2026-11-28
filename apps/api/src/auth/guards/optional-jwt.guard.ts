import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable, catchError, map, of } from 'rxjs';

/**
 * Allows guests through while still populating request.user when a valid token
 * is present. Unlike JwtAuthGuard it must NOT honour @Public() by skipping
 * passport entirely — cart and guest-checkout endpoints need the user when a
 * bearer token is supplied so the server can choose the user cart.
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const result = super.canActivate(context) as
      | boolean
      | Promise<boolean>
      | Observable<boolean>;
    if (result instanceof Observable) {
      return result.pipe(
        map((allowed) => allowed !== false),
        catchError(() => of(true)),
      );
    }
    return Promise.resolve(result)
      .then((allowed) => allowed !== false)
      .catch(() => true);
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser | false): TUser | null {
    if (err || !user) return null;
    return user;
  }
}
