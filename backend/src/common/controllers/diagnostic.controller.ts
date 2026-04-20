import { Controller, Get, Req, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Public } from '../decorators/public.decorator.js';

@Controller('diagnostic')
export class DiagnosticController {
  constructor(private readonly config: ConfigService) {}

  // Dev-only probe: verifies trust-proxy hop count produces correct client IP.
  @Public()
  @Get('ip')
  getIpInfo(@Req() req: Request) {
    if (this.config.get<string>('app.nodeEnv') === 'production') {
      throw new NotFoundException();
    }
    return {
      ip: req.ip,
      ips: req.ips,
      xff: req.get('x-forwarded-for') ?? null,
      trustProxy: this.config.get<number>('app.trustProxy'),
    };
  }
}
