import {
  Controller,
  Query,
  Sse,
  ParseIntPipe,
  BadRequestException,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { OnEvent } from '@nestjs/event-emitter';
import { Subject, Observable, merge, interval } from 'rxjs';
import { filter, map, finalize } from 'rxjs/operators';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator.js';

interface CommentEventPayload {
  commentableType: string;
  commentableId: number;
  authorId: number | null;
}

// SSE is long-lived; throttle protects against open-storms, in-memory counter
// caps concurrent connections per IP to prevent FD/fanout exhaustion.
const MAX_CONNECTIONS_PER_IP = 3;
const HEARTBEAT_INTERVAL_MS = 30_000;

@ApiTags('comment-stream')
@Controller('comments')
export class CommentStreamController {
  private readonly events$ = new Subject<CommentEventPayload>();
  private readonly ipConnections = new Map<string, number>();

  @OnEvent('comment.created.public')
  handleCreated(payload: CommentEventPayload): void {
    this.events$.next(payload);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Public()
  @Sse('stream')
  @ApiOperation({ summary: 'SSE stream for new public comments on a thread' })
  @ApiQuery({ name: 'type', required: true, enum: ['manga', 'chapter'] })
  @ApiQuery({ name: 'id', required: true, type: Number })
  stream(
    @Query('type') type: string,
    @Query('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ): Observable<{ data: string }> {
    if (type !== 'manga' && type !== 'chapter') {
      throw new BadRequestException('type must be "manga" or "chapter"');
    }

    // `req.ip` is the real client IP because `app.set('trust proxy', 2)` is global.
    const ip = req.ip ?? 'unknown';
    const current = this.ipConnections.get(ip) ?? 0;
    if (current >= MAX_CONNECTIONS_PER_IP) {
      throw new HttpException(
        'Too many concurrent comment-stream connections from this IP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.ipConnections.set(ip, current + 1);

    const heartbeat$ = interval(HEARTBEAT_INTERVAL_MS).pipe(
      map(() => ({ data: JSON.stringify({ type: 'heartbeat' }) })),
    );
    const filtered$ = this.events$.pipe(
      filter((e) => e.commentableType === type && e.commentableId === id),
      map((e) => ({
        data: JSON.stringify({
          type: 'comment.new',
          authorId: e.authorId,
        }),
      })),
    );
    return merge(filtered$, heartbeat$).pipe(
      finalize(() => {
        const c = this.ipConnections.get(ip) ?? 0;
        if (c <= 1) this.ipConnections.delete(ip);
        else this.ipConnections.set(ip, c - 1);
      }),
    );
  }
}
