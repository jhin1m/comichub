# Phase 3 — Trigger Mirror Job từ ChapterService.findOne

## Context Links

- Source report: `../reports/ask-260501-1801-image-storage-strategy.md` (section "Phase 3 — Trigger từ ChapterService")
- File hiện tại: `backend/src/modules/manga/services/chapter.service.ts` (`findOne` line 83-111)
- Phase 1 prereq: `MirrorModule` export `BullModule` với queue `mirror`
- Phase 2 prereq: `ImageMirrorProcessor` consume queue
- Redis status pattern: `backend/src/modules/auth/auth.module.ts` (REDIS_AVAILABLE wiring), `backend/src/jobs/counter-flush.job.ts` (gating example)

## Overview

- **Priority:** P2
- **Status:** pending
- **Effort:** 0.5 ngày
- Inject `Queue` vào `ChapterService`, sau khi load images trong `findOne` enqueue job nếu có image với `imageUrl === sourceUrl`. Gate bằng `REDIS_AVAILABLE`. Không await job — response trả ngay.

## Key Insights

- `ChapterService.findOne(id)` hiện return `{ ...chapter, mangaTitle, contentRating, images, groups }`. Images load qua `Promise.all` ở line 97-108. Spot enqueue: NGAY SAU `Promise.all`, TRƯỚC `return`.
- `MangaModule` chưa import `MirrorModule` → cần thêm vào imports để `BullModule.registerQueue` propagate.
- `MangaModule` cũng chưa wire `REDIS_AVAILABLE` (auth module owns nó hiện tại). Phải import `AuthModule` đã sẵn (line 20: `imports: [AuthModule]`) — `AuthModule` exports `REDIS_AVAILABLE`. OK.
- `jobId: chapter:${chapterId}` dedup: BullMQ skip nếu job same id còn trong queue (waiting/active). Sau khi job complete + remove, jobId free → enqueue lần sau OK (nhưng app-level check `imageUrl === sourceUrl` sẽ chặn trước đó nếu đã mirror).
- Enqueue dùng `await this.mirrorQueue.add(...)` — await chỉ cho Redis ack (~1ms), KHÔNG đợi job execute. Response latency tăng không đáng kể.
- Try-catch wrap enqueue: nếu Redis flap mid-request → enqueue throw → fallback hotlink (catch + log + continue).

## Requirements

### Functional
- `ChapterService` constructor inject:
  - `@InjectQueue('mirror') mirrorQueue: Queue`
  - `@Inject(REDIS_AVAILABLE) redisStatus: RedisStatus`
- `findOne` sau khi load images:
  1. Skip nếu `redisStatus.available === false`.
  2. Compute `needsMirror = images.some(img => img.imageUrl === img.sourceUrl)`.
  3. Nếu `needsMirror` → `mirrorQueue.add('mirror-chapter', { chapterId: id }, { jobId: 'chapter:' + id, attempts: 3, backoff: { type: 'exponential', delay: 5000 } })`.
  4. Wrap try-catch — log warn nếu enqueue throw, không propagate.
- Response shape KHÔNG ĐỔI.

### Non-Functional
- Enqueue overhead < 5ms p99 (Redis local).
- `ChapterService.findOne` không tăng quá 1 await statement (KISS).
- Test coverage: existing `chapter.service.spec.ts` tests pass + 2 new tests (Phase 4).

## Architecture

### Flow

```
GET /api/v1/chapters/:id
    ↓
ChapterService.findOne(id)
    ├─ Load chapter+manga (existing)
    ├─ Load images + chapterGroups (existing Promise.all)
    ├─ [NEW] if (redisStatus.available)
    │     needsMirror = images.some(img => imageUrl === sourceUrl)
    │     if (needsMirror) try { await mirrorQueue.add(...) } catch (warn)
    └─ return { ...chapter, images, groups }  ← response NGAY
       ↓
[Background] BullMQ worker pick job → ImageMirrorProcessor.process
```

### Dedup layers (idempotent)

1. **App-level**: `images.some(img => imageUrl === sourceUrl)` — không enqueue nếu chapter đã fully mirrored.
2. **Queue-level**: BullMQ `jobId: chapter:${id}` — duplicate add() trong khi job waiting/active là no-op (returns existing job).
3. **Worker-level (Phase 2)**: query `WHERE imageUrl = sourceUrl AND chapterId = X` — race condition between enqueue và worker pickup không gây double-mirror.

## Related Code Files

### Modify
- `backend/src/modules/manga/services/chapter.service.ts` — inject queue + redisStatus, add enqueue logic vào `findOne`.
- `backend/src/modules/manga/manga.module.ts` — import `MirrorModule` vào `imports`.

### Không đụng
- `chapter.controller.ts` — không thay endpoint shape.
- `manga.types.ts` — `ChapterWithImages` type unchanged.
- Other ChapterService methods (`findByManga`, `getNavigation`, `create`, `update`, `remove`).

## Implementation Steps

1. **Update `manga.module.ts`**
   ```ts
   import { MirrorModule } from '../mirror/mirror.module.js';

   @Module({
     imports: [AuthModule, MirrorModule],
     // ... rest unchanged
   })
   ```

2. **Update `chapter.service.ts` constructor**
   ```ts
   import { InjectQueue } from '@nestjs/bullmq';
   import { Queue } from 'bullmq';
   import { Inject } from '@nestjs/common';
   import {
     REDIS_AVAILABLE,
     type RedisStatus,
   } from '../../../common/providers/redis.provider.js';

   @Injectable()
   export class ChapterService {
     private readonly logger = new Logger(ChapterService.name);

     constructor(
       @Inject(DRIZZLE) private db: DrizzleDB,
       private readonly eventEmitter: EventEmitter2,
       @InjectQueue('mirror') private mirrorQueue: Queue,
       @Inject(REDIS_AVAILABLE) private redisStatus: RedisStatus,
     ) {}
     // ...
   }
   ```

3. **Add enqueue trong `findOne`** (sau `Promise.all` line 108, trước `return`)
   ```ts
   const [images, chapterGroupRows] = await Promise.all([ /* existing */ ]);

   // Demand-driven mirror trigger
   if (this.redisStatus.available) {
     const needsMirror = images.some(
       (img) => img.sourceUrl !== null && img.imageUrl === img.sourceUrl,
     );
     if (needsMirror) {
       try {
         await this.mirrorQueue.add(
           'mirror-chapter',
           { chapterId: id },
           {
             jobId: `chapter:${id}`,
             attempts: 3,
             backoff: { type: 'exponential', delay: 5000 },
             removeOnComplete: true,
             removeOnFail: { age: 86400 }, // keep 1d for debug
           },
         );
       } catch (err) {
         this.logger.warn(
           `Failed to enqueue mirror for chapter ${id}: ${(err as Error).message}`,
         );
       }
     }
   }

   return { ...row.chapter, mangaTitle: row.mangaTitle, contentRating: row.contentRating, images, groups: chapterGroupRows };
   ```

4. **Update existing `chapter.service.spec.ts`** providers (Phase 4 expand)
   - Add `{ provide: 'BullQueue_mirror', useValue: { add: vi.fn() } }` (BullMQ injection token format).
   - Add `{ provide: REDIS_AVAILABLE, useValue: { available: true } }`.
   - Existing tests should pass without test logic change (mock returns truthy/no-op).

5. **Verify**
   - `pnpm run build` clean.
   - `pnpm run lint` clean.
   - `pnpm run test src/modules/manga/services/chapter.service.spec.ts` pass.
   - Manual smoke: GET `/api/v1/chapters/:id` returns NGAY (< 100ms typical), Redis MONITOR show `BZPOPMIN bull:mirror:wait` activity.

## Todo List

- [ ] Import `MirrorModule` vào `manga.module.ts` imports
- [ ] Add imports trong `chapter.service.ts`: `InjectQueue`, `Queue`, `REDIS_AVAILABLE`, `RedisStatus`, `Logger`, `Inject`
- [ ] Inject `mirrorQueue` + `redisStatus` vào constructor
- [ ] Compute `needsMirror` sau `Promise.all` images load
- [ ] Wrap `mirrorQueue.add(...)` trong try-catch, log warn on error
- [ ] Pass `jobId: chapter:${id}`, attempts 3, exponential backoff 5s
- [ ] Set `removeOnComplete: true`, `removeOnFail: { age: 86400 }`
- [ ] Update `chapter.service.spec.ts` providers thêm BullQueue mock + REDIS_AVAILABLE
- [ ] `pnpm run build` + `pnpm run lint` + `pnpm run test` pass

## Success Criteria

- [ ] `ChapterService.findOne` enqueue job khi có image unmirrored AND `redisStatus.available === true`.
- [ ] Response shape không đổi (`ChapterWithImages` type unchanged).
- [ ] Redis down → enqueue path skip, response trả bình thường.
- [ ] Enqueue throw → log warn, response vẫn trả bình thường (không 500).
- [ ] 10 concurrent GET cùng `chapterId` → Redis chỉ thấy 1 job key `bull:mirror:chapter:X` (jobId dedup verified).
- [ ] Existing `chapter.service.spec.ts` tests vẫn pass.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `await mirrorQueue.add` adds latency to hot path | Med | Med | Redis local ~1ms; fire-and-forget pattern via try-catch (no propagate); monitor p99 latency post-deploy |
| Enqueue throw → response 500 | Low | High | Try-catch wrap, warn log only |
| Existing tests fail do constructor signature đổi | High | Low | Update spec providers thêm BullQueue + REDIS_AVAILABLE mocks |
| Race: 100 user mở chapter cùng lúc → 100 enqueue calls | High | Low | BullMQ jobId dedup ở queue layer → 1 job thực tế |
| `images` array empty (chapter chưa có pages) | Low | Low | `.some()` trên empty = false → no enqueue, OK |
| `sourceUrl === null` images skip đúng | Med | Low | Guard `img.sourceUrl !== null` trong predicate |

## Security Considerations

- Không leak job internals trong response (job ID, queue state) — enqueue silent.
- `chapterId` từ path param đã validate (NestJS pipe int parse) — không SSRF risk ở enqueue layer.
- Per CLAUDE.md "Content-rating filter ≠ access control" — `findOne` không gate NSFW, mirror cũng không gate (đúng — mirror là storage concern, không phải access).

## Next Steps

- Phase 4 — write tests (unit + integration) cho processor + service enqueue path.
- Sau merge Phase 3: end-to-end demand-driven flow active production-ready.

## Rollback Plan

- Revert commit (2 files: `chapter.service.ts`, `manga.module.ts`).
- Phase 1 + Phase 2 remain — queue exists nhưng không trigger từ user request.
- `MirrorModule` orphan provider OK (worker idle, không impact).
- Manual enqueue qua REPL/admin endpoint (future) vẫn dùng được.

## Unresolved Questions

- `removeOnFail: { age: 86400 }` keep failed jobs 1 ngày — đủ cho debug? Hay 7 ngày? (Đề xuất: 1 ngày, tránh bloat Redis.)
- Có cần emit event `chapter.mirror.requested` cho observability không? (Defer — YAGNI.)
