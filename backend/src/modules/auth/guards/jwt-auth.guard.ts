import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // Still try to authenticate — populate request.user if valid token exists
      // but don't fail if no token or invalid token
      try {
        await (super.canActivate(context) as Promise<boolean>);
      } catch {
        // Ignore auth errors on public routes
      }
      return true;
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
