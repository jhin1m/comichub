# Phase 2 — Refactor ImageMirrorJob → BullMQ Processor

## Context Links

- Source report: `../reports/ask-260501-1801-image-storage-strategy.md` (section "Phase 2 — Refactor ImageMirrorJob")
- File hiện tại: `backend/src/jobs/image-mirror.job.ts` (190 lines, cron-based, FIFO 50 oldest)
- Jobs module: `backend/src/jobs/jobs.module.ts` (đăng ký provider `ImageMirrorJob`)
- Phase 1 prereq: `MirrorModule` đã có queue `mirror` registered

## Overview

- **Priority:** P2
- **Status:** pending
- **Effort:** 0.5 ngày
- Convert `ImageMirrorJob` (cron + FIFO) thành `ImageMirrorProcessor` (BullMQ Worker) scoped per `chapterId` từ job data. Reuse 100% download/optimize/upload logic. Bỏ `IMAGE_MIRROR_JOB_ENABLED` flag và `@Cron` decorator.

## Key Insights

- File `image-mirror.job.ts` chứa 3 method có thể tái dùng nguyên: `downloadImage`, `optimizeImage`, `uploadToS3`. Chỉ thay entrypoint (`mirrorImages` cron handler → `process(job)`).
- Logic FIFO + `running` flag + `byChapter` Map + `CHAPTER_DELAY_MS` được loại bỏ — BullMQ handle queueing + concurrency native.
- Constants `MAX_WIDTH`, `DOWNLOAD_TIMEOUT_MS`, `MAX_DOWNLOAD_BYTES` giữ nguyên.
- Per CLAUDE.md "no `enhanced-*.ts` / `*-v2.ts`" → refactor in-place. Đổi tên file `image-mirror.job.ts` → `image-mirror.processor.ts` và class `ImageMirrorJob` → `ImageMirrorProcessor`.
- Query scoped per chapterId: thêm `eq(chapterImages.chapterId, chapterId)` vào WHERE — bỏ `.limit(BATCH_SIZE)`.
- Job idempotency: query `imageUrl = sourceUrl AND chapterId = X` → nếu rỗng → return sớm (đã mirror hết do retry hoặc parallel).

## Requirements

### Functional
- Class `ImageMirrorProcessor extends WorkerHost` với `@Processor('mirror')`.
- `process(job: Job<{ chapterId: number }>)` query unmirrored images SCOPED theo `chapterId`, mirror tuần tự, update `imageUrl`.
- Reuse `downloadImage`, `optimizeImage`, `uploadToS3` private methods (giữ nguyên signature + body).
- `@Cron('*/10 * * * *')` decorator REMOVED.
- Flag `IMAGE_MIRROR_JOB_ENABLED` REMOVED khỏi code (env entry sẽ document trong commit message).
- `safeHttpsFetch` + `sharp` config + S3 key pattern KHÔNG ĐỔI.

### Non-Functional
- File mới under 200 lines (split utility nếu vượt).
- Worker concurrency: 4 (set ở `@Processor('mirror', { concurrency: 4 })` hoặc qua `WorkerHost` options).
- Failed job: BullMQ retry 3 attempts, exponential backoff 5s (set ở caller Phase 3 hoặc default options Phase 1).

## Architecture

### Data flow

```
Job { chapterId }
    ↓
Query chapter_images JOIN chapters
  WHERE chapterImages.chapterId = chapterId
    AND sourceUrl IS NOT NULL
    AND imageUrl = sourceUrl
    ↓
For each img:
  safeHttpsFetch(sourceUrl) → Buffer
    ↓
  sharp resize(<=1200) + WebP q85 → Buffer
    ↓
  S3 PUT manga/{mangaId}/chapters/{chapterId}/{pageNumber}.webp
    ↓
  UPDATE chapter_images SET imageUrl = `${publicUrl}/${key}` WHERE id = img.id
    ↓
[Per-image error] → log warn, skip image, continue
[Job-level error] → BullMQ retry per attempts policy
```

### Worker lifecycle

- BullMQ creates Worker với connection từ Phase 1 BullModule.
- 4 jobs parallel max (concurrency: 4).
- Job timeout: default (no explicit timeout — relies on per-image `DOWNLOAD_TIMEOUT_MS` 30s × N images).

## Related Code Files

### Modify (rename + rewrite)
- `backend/src/jobs/image-mirror.job.ts` → DELETE (rename via git mv) thành `backend/src/modules/mirror/image-mirror.processor.ts`.
  - Lý do move: cohesion với `MirrorModule` Phase 1.
- `backend/src/jobs/jobs.module.ts` — remove `ImageMirrorJob` import + provider entry.
- `backend/src/modules/mirror/mirror.module.ts` (Phase 1) — add `ImageMirrorProcessor` to providers.

### Không đụng
- `backend/src/common/utils/safe-http.util.ts` — SSRF defense unchanged.
- `backend/src/database/schema/chapter-image.schema.ts` — schema zero change.
- S3 client setup pattern.

## Implementation Steps

1. **Move file**
   ```bash
   git mv backend/src/jobs/image-mirror.job.ts \
          backend/src/modules/mirror/image-mirror.processor.ts
   ```

2. **Rewrite class shell** trong `image-mirror.processor.ts`
   ```ts
   import { Processor, WorkerHost } from '@nestjs/bullmq';
   import type { Job } from 'bullmq';
   // ... giữ existing imports (S3Client, sharp, drizzle, schema, safeHttpsFetch)

   @Processor('mirror', { concurrency: 4 })
   export class ImageMirrorProcessor extends WorkerHost {
     private readonly logger = new Logger(ImageMirrorProcessor.name);
     // ... s3, bucket, publicUrl init giữ nguyên trong constructor

     async process(job: Job<{ chapterId: number }>): Promise<void> {
       const { chapterId } = job.data;

       const unmirrored = await this.db
         .select({ ... })  // giữ nguyên columns
         .from(chapterImages)
         .innerJoin(chapters, eq(chapters.id, chapterImages.chapterId))
         .where(and(
           eq(chapterImages.chapterId, chapterId),
           isNotNull(chapterImages.sourceUrl),
           sql`${chapterImages.imageUrl} = ${chapterImages.sourceUrl}`,
         ));

       if (!unmirrored.length) return;

       this.logger.log(`Mirror chapter ${chapterId}: ${unmirrored.length} images`);
       let mirrored = 0;

       for (const img of unmirrored) {
         try {
           const buffer = await this.downloadImage(img.sourceUrl!);
           const optimized = await this.optimizeImage(buffer);
           const key = `manga/${img.mangaId}/chapters/${chapterId}/${img.pageNumber}.webp`;
           await this.uploadToS3(key, optimized);
           const s3Url = `${this.publicUrl}/${key}`;
           await this.db.update(chapterImages)
             .set({ imageUrl: s3Url })
             .where(eq(chapterImages.id, img.id));
           mirrored++;
         } catch (err) {
           this.logger.warn(`Failed image ${img.id}: ${(err as Error).message}`);
         }
       }

       this.logger.log(`Mirrored ${mirrored}/${unmirrored.length} for chapter ${chapterId}`);
     }

     // downloadImage / optimizeImage / uploadToS3 → COPY NGUYÊN từ file cũ
   }
   ```

3. **Remove cron + flag artifacts**
   - Xoá `@Cron` decorator import.
   - Xoá `mirrorImages()` wrapper method (logic move vào `process`).
   - Xoá `running` flag, `BATCH_SIZE`, `CHAPTER_DELAY_MS` constants, `byChapter` Map logic.
   - Xoá check `config.get('IMAGE_MIRROR_JOB_ENABLED')`.

4. **Update `jobs.module.ts`**
   - Remove `import { ImageMirrorJob } from './image-mirror.job.js';`.
   - Remove `ImageMirrorJob` từ `providers` array.

5. **Update `mirror.module.ts`** (Phase 1 file)
   ```ts
   import { ImageMirrorProcessor } from './image-mirror.processor.js';

   @Module({
     imports: [BullModule.registerQueue({ name: 'mirror' })],
     providers: [ImageMirrorProcessor],
     exports: [BullModule],
   })
   ```

6. **Cleanup env**
   - `.env.example` (nếu có): remove `IMAGE_MIRROR_JOB_ENABLED` entry.
   - Document trong commit body: "removed flag, replaced by demand-driven enqueue".

7. **Verify**
   - `pnpm run build` clean.
   - `pnpm run lint` clean.
   - Smoke: enqueue 1 test job manually qua REPL hoặc test fixture → verify worker pick up.

## Todo List

- [ ] `git mv` file sang `modules/mirror/image-mirror.processor.ts`
- [ ] Rename class `ImageMirrorJob` → `ImageMirrorProcessor`
- [ ] Decorate `@Processor('mirror', { concurrency: 4 })`, extend `WorkerHost`
- [ ] Implement `process(job)` scoped chapterId, query + loop mirror
- [ ] Copy nguyên `downloadImage`, `optimizeImage`, `uploadToS3` từ file cũ
- [ ] Xoá `@Cron`, `mirrorImages`, `running` flag, `BATCH_SIZE`, `CHAPTER_DELAY_MS`, `byChapter` logic
- [ ] Xoá check `IMAGE_MIRROR_JOB_ENABLED`
- [ ] Update `jobs.module.ts` remove `ImageMirrorJob` provider
- [ ] Update `mirror.module.ts` add `ImageMirrorProcessor` provider
- [ ] Remove `IMAGE_MIRROR_JOB_ENABLED` từ `.env.example` nếu có
- [ ] `pnpm run build` + `pnpm run lint` pass

## Success Criteria

- [ ] File `image-mirror.processor.ts` exists, class `ImageMirrorProcessor` với `@Processor('mirror')`.
- [ ] File cũ `image-mirror.job.ts` không còn (git mv).
- [ ] `jobs.module.ts` không reference `ImageMirrorJob`.
- [ ] `mirror.module.ts` providers chứa `ImageMirrorProcessor`.
- [ ] `grep -rn "IMAGE_MIRROR_JOB_ENABLED" backend/src` returns 0 results.
- [ ] `grep -rn "@Cron.*\*/10" backend/src` returns 0 results (chỉ context cron mirror cũ).
- [ ] Manual smoke: enqueue `{ chapterId: <test_id> }` → log "Mirror chapter X" → DB row imageUrl đổi sang publicUrl.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Worker không pick up job (Redis connect issue) | Med | High | Verify Phase 1 BullModule connection via boot log; add explicit `WorkerOptions` log |
| Sharp/safeHttpsFetch behavior thay đổi do refactor | Low | High | Copy nguyên 3 methods, không đụng signature/body |
| Per-image error làm fail toàn job | Low | Med | Try-catch per-image (giống code cũ), warn log, continue |
| 4 concurrent workers hammer same source domain | Med | Med | Defer rate limiter (per report); monitor logs Phase 4 smoke |
| Job retry sau crash duplicate upload S3 | Low | Low | Idempotent: query trước upload, S3 PUT same key overwrite OK |

## Security Considerations

- `safeHttpsFetch` SSRF defense — KHÔNG bypass, KHÔNG đổi user-agent semantics.
- Job data chỉ chứa `chapterId` (number) — no user PII, no secret.
- S3 credentials đọc từ ConfigService như cũ — không đổi scope.
- `MAX_DOWNLOAD_BYTES` 20MB cap giữ nguyên.

## Next Steps

- Phase 3 — inject `@InjectQueue('mirror')` vào `ChapterService`, enqueue trong `findOne`.
- Dependency: Phase 2 phải merge trước để có processor consume jobs Phase 3 enqueue.

## Rollback Plan

- Revert commit (file rename + 2 module edits).
- Restore `image-mirror.job.ts` từ git history → re-add provider trong `jobs.module.ts`.
- Cron-based mirror resume hoạt động (cần `IMAGE_MIRROR_JOB_ENABLED=true` trong env).

## Unresolved Questions

- Concurrency 4 fixed hay expose env `MIRROR_WORKER_CONCURRENCY`? (Đề xuất: hardcode 4, defer config khi gặp issue thực tế.)
- Job-level timeout — set explicit (vd 5 phút) hay rely per-image timeout? (Đề xuất: rely per-image; revisit nếu thấy stuck jobs.)
