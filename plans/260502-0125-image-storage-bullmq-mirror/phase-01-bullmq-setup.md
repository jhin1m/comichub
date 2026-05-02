# Phase 1 — BullMQ Setup

## Context Links

- Source report: `../reports/ask-260501-1801-image-storage-strategy.md` (section "Phase 1 — BullMQ setup")
- Backend rules: `backend/CLAUDE.md` (module setup recipe)
- Redis provider hiện tại: `backend/src/common/providers/redis.provider.ts`
- Redis config: `backend/src/config/redis.config.ts` (chỉ `redis.url`, không có `host`/`port`)
- Auth module mẫu wiring `REDIS_CLIENT` + `REDIS_AVAILABLE`: `backend/src/modules/auth/auth.module.ts`

## Overview

- **Priority:** P2 (foundation cho Phase 2-3)
- **Status:** pending
- **Effort:** 0.5 ngày
- Setup BullMQ runtime: install package, register `BullModule.forRootAsync` global, register queue `mirror`, tạo `MirrorModule` wrapper export queue.

## Key Insights

- BullMQ cần Redis connection. Dự án đã có `createResilientRedis` graceful fallback, nhưng BullMQ internals dùng connection riêng (ioredis instance riêng cho queue + worker). Không share `REDIS_CLIENT` token vì BullMQ yêu cầu connection options object.
- Redis config thực tế chỉ expose `redis.url` (URL string) — KHÔNG có `redis.host`/`redis.port` như report ví dụ. Phải parse URL hoặc dùng `connection: { url }` form của BullMQ (BullMQ v5 hỗ trợ).
- Khi Redis down, BullMQ throw khi connect. Phải gate `mirrorQueue.add(...)` ở caller bằng `REDIS_AVAILABLE` (làm ở Phase 3) — Phase 1 chỉ setup, không cần extra fallback ở module level.

## Requirements

### Functional
- `@nestjs/bullmq` + `bullmq` được install ở `backend/`.
- `BullModule.forRootAsync` register ở `app.module.ts` với connection từ `ConfigService`.
- Queue tên `mirror` đăng ký global, inject được qua `@InjectQueue('mirror')`.
- Tạo `backend/src/modules/mirror/mirror.module.ts` wrapper export queue cho consumer (ChapterService Phase 3).

### Non-Functional
- `pnpm run build` pass sau khi thêm deps.
- Không break existing modules (jobs, manga, ...).
- Tuân `nodenext` — local imports dùng `.js` extension.

## Architecture

```
AppModule
  └── BullModule.forRootAsync (connection: { url: redis.url })  ← global
  └── MirrorModule
        └── BullModule.registerQueue({ name: 'mirror' })
        └── exports: BullModule  (để MangaModule import nếu cần inject queue)
```

Phase 2 sẽ thêm `ImageMirrorProcessor` vào `MirrorModule.providers`.
Phase 3 sẽ `MangaModule.imports.push(MirrorModule)` và inject `@InjectQueue('mirror')` vào `ChapterService`.

## Related Code Files

### Modify
- `backend/package.json` — add `@nestjs/bullmq`, `bullmq` (latest stable cho NestJS 11).
- `backend/src/app.module.ts` — import `BullModule.forRootAsync(...)`, import `MirrorModule`.

### Create
- `backend/src/modules/mirror/mirror.module.ts` — wrapper module register queue + export.

### Không đụng
- `jobs.module.ts` (Phase 2 sẽ remove `ImageMirrorJob` provider).
- `auth.module.ts` Redis wiring (BullMQ dùng connection độc lập).
- Bất kỳ service nào khác.

## Implementation Steps

1. **Install deps**
   ```bash
   cd backend && pnpm add @nestjs/bullmq bullmq
   ```
   Verify `pnpm run build` clean.

2. **Register BullModule global trong `app.module.ts`**
   ```ts
   import { BullModule } from '@nestjs/bullmq';
   import { ConfigService } from '@nestjs/config';

   @Module({
     imports: [
       // ... existing
       BullModule.forRootAsync({
         inject: [ConfigService],
         useFactory: (config: ConfigService) => ({
           connection: { url: config.getOrThrow<string>('redis.url') },
         }),
       }),
       MirrorModule,
       // ... rest
     ],
   })
   ```

3. **Tạo `mirror.module.ts`**
   ```ts
   import { Module } from '@nestjs/common';
   import { BullModule } from '@nestjs/bullmq';

   @Module({
     imports: [BullModule.registerQueue({ name: 'mirror' })],
     exports: [BullModule],
   })
   export class MirrorModule {}
   ```

4. **Verify**
   - `pnpm run build` → no TS errors.
   - `pnpm run start:dev` boot, log không error BullMQ connection (Redis must be up locally).
   - `pnpm run lint` pass.

## Todo List

- [ ] `pnpm add @nestjs/bullmq bullmq` ở `backend/`
- [ ] Register `BullModule.forRootAsync` trong `app.module.ts` dùng `redis.url`
- [ ] Create `backend/src/modules/mirror/mirror.module.ts` register queue `mirror`
- [ ] Import `MirrorModule` vào `AppModule.imports`
- [ ] `pnpm run build` pass
- [ ] `pnpm run lint` pass
- [ ] Boot `pnpm run start:dev`, verify no BullMQ connection error trong logs

## Success Criteria

- [ ] `@nestjs/bullmq` + `bullmq` in `package.json` dependencies.
- [ ] `BullModule.forRootAsync` configured với `redis.url` từ ConfigService.
- [ ] Queue `mirror` registered và injectable.
- [ ] `MirrorModule` export `BullModule` cho consumer.
- [ ] Build + lint clean.
- [ ] App boot không crash khi Redis up.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| BullMQ v5 không nhận `connection: { url }` form | Low | Med | Fallback parse URL → `{ host, port, password }` qua `new URL(url)` |
| Boot crash khi Redis down | Med | Med | BullMQ lazy-connect by default; queue.add() ở Phase 3 gate bằng `REDIS_AVAILABLE` |
| Conflict version với `ioredis` ^5.10.1 hiện có | Low | Low | bullmq peer-dep ioredis, pnpm sẽ resolve. Verify `pnpm install` không warn |

## Security Considerations

- Không log Redis URL (có thể chứa password). ConfigService mặc định không log.
- BullMQ jobs chứa `chapterId` — không phải PII, OK plaintext.

## Next Steps

- Phase 2 — refactor `ImageMirrorJob` thành processor consume queue `mirror`.
- Dependency: Phase 1 phải merge trước để Phase 2 có queue + module hook vào.

## Rollback Plan

- Revert commit (3 files: `package.json`, `app.module.ts`, `mirror.module.ts` deletion).
- Existing cron `ImageMirrorJob` vẫn hoạt động độc lập (chưa đụng ở Phase 1).

## Unresolved Questions

- BullMQ default `removeOnComplete` / `removeOnFail` policy — keep default hay set explicit ở `forRootAsync` defaultJobOptions? (Đề xuất: defer Phase 2 khi config processor.)
