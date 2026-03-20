import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import type { User } from '../../../database/schema/index.js';

@Injectable()
export class BanCheckMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const user = req.user as User | undefined;
    if (user?.bannedUntil && new Date(user.bannedUntil) > new Date()) {
      throw new ForbiddenException({
        message: 'Account is banned',
        bannedUntil: user.bannedUntil,
      });
    }
    next();
  }
}
