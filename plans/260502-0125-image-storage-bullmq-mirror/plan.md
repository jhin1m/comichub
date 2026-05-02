---
title: "Image Storage — Demand-Driven Mirror với BullMQ"
description: "Refactor cron-based ImageMirrorJob sang BullMQ processor, trigger lazy từ ChapterService.findOne. Schema = 0 thay đổi."
status: completed
priority: P2
effort: 1.5d
branch: main
tags: [backend, storage, bullmq, image-mirror, refactor]
created: 2026-05-02
completed: 2026-05-02
---

# Plan — Image Storage Demand-Driven Mirror

## Mục tiêu

Chuyển image-mirror từ cron `*/10 * * * *` (FIFO 50 oldest) sang on-demand BullMQ queue scoped per-chapter, trigger lazy khi user mở chapter chưa cached. Zero schema migration. Giữ nguyên 100% logic mirror (safeHttpsFetch, sharp WebP 1200w, S3 upload).

## Source

- Architecture report: `plans/reports/ask-260501-1801-image-storage-strategy.md` (authoritative spec, không redesign)

## Phases

| # | Phase | File | Status | Effort |
|---|---|---|---|---|
| 1 | BullMQ setup — install deps, register BullModule, tạo MirrorModule | [phase-01-bullmq-setup.md](./phase-01-bullmq-setup.md) | completed | 0.5d |
| 2 | Refactor ImageMirrorJob → BullMQ Processor scoped chapterId | [phase-02-refactor-mirror-processor.md](./phase-02-refactor-mirror-processor.md) | completed | 0.5d |
| 3 | Inject queue vào ChapterService.findOne, enqueue jobId dedup | [phase-03-trigger-from-chapter-service.md](./phase-03-trigger-from-chapter-service.md) | completed | 0.5d |
| 4 | Tests — unit (8) theo test plan; integration `mirror-flow.integration.spec.ts` skipped (real-Redis dependency, deferred) | [phase-04-tests.md](./phase-04-tests.md) | completed | 0.5d |

## Post-implementation deltas vs plan

- Code-reviewer fixes (applied): S3 key now includes `groupId` segment (data-loss avoided per schema unique `(chapterId, pageNumber, groupId)`); processor throws when **all** images fail so BullMQ retry policy fires (transient outage path); `tests/helpers/test-app.ts` BullMQ root uses `lazyConnect`/`enableOfflineQueue: false`/`maxRetriesPerRequest: 0` to silence ECONNREFUSED.
- DRY refinement: `attempts: 3`, `backoff: exponential 5s`, `removeOnComplete: true`, `removeOnFail: { age: 86400 }` set once in `BullModule.forRootAsync` defaultJobOptions; `ChapterService.add()` only passes `jobId`.
- Pnpm major-version migration (v10→v11) executed during Phase 1 — added `pnpm-workspace.yaml` allowBuilds entry.

## Dependency Chain

```
Phase 1 (deps + module) → Phase 2 (processor) → Phase 3 (trigger) → Phase 4 (tests)
```

Mỗi phase merge độc lập được nhưng chain tuần tự — Phase 2 cần BullModule; Phase 3 cần processor active; Phase 4 verify end-to-end.

## Key Constraints

- **Zero schema change.** Cờ "đã mirror" = `imageUrl === sourceUrl`.
- **Reuse 100%** download/optimize/upload logic — chỉ swap trigger.
- **No `enhanced-*.ts` / `*-v2.ts`** — refactor in-place.
- **Redis optional** — gate enqueue bằng `REDIS_AVAILABLE` token, fallback hotlink khi Redis down.
- **No await job** — response chapter trả NGAY, mirror background.
- **Out of scope** (defer): admin manual re-mirror endpoint, bull-board UI, per-source rate limiter.

## Acceptance (overall)

- `IMAGE_MIRROR_JOB_ENABLED` flag và cron `*/10 * * * *` xoá hoàn toàn.
- 10 concurrent requests cùng chapter → 1 job duy nhất (jobId dedup).
- Worker crash mid-mirror → restart → finish remaining (idempotent).
- Redis down → enqueue skip, hotlink fallback.
- `pnpm run build` + `pnpm run lint` + `pnpm run test` pass.

## Discrepancy với report

- Report mô tả `BullModule.forRootAsync` dùng `redis.host` + `redis.port`. Config thực tế chỉ có `redis.url` (xem `src/config/redis.config.ts`). Plan dùng `redis.url`.
