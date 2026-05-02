# Phase 4 — Tests

## Context Links

- Source report: `../reports/ask-260501-1801-image-storage-strategy.md` (section "Test plan")
- Backend test config: `backend/vitest.config.ts`, `backend/vitest.e2e.config.ts`
- Existing pattern reference: `backend/src/modules/manga/services/chapter.service.spec.ts`, `backend/src/jobs/counter-flush.job.spec.ts`
- Test setup: `backend/tests/setup.ts`, integration dir `backend/tests/integration/`

## Overview

- **Priority:** P2
- **Status:** pending
- **Effort:** 0.5 ngày
- Cover unit (processor idempotency, service enqueue branch) + integration (end-to-end mirror flow). Per CLAUDE.md: KHÔNG mock DB cho integration; mock S3/sharp ở unit OK.

## Key Insights

- Existing `chapter.service.spec.ts` dùng mock `buildChain()` cho Drizzle. Phase 3 thêm enqueue dependency → spec phải provide BullQueue mock + REDIS_AVAILABLE.
- Processor unit test: mock S3Client (PutObjectCommand), mock sharp output, real Drizzle? KHÔNG — DB mock OK cho processor unit (test logic flow), DB real ở integration test.
- Integration test cần real Redis + real Postgres. Existing integration tests làm gì? Tham khảo `backend/tests/integration/` (cần verify pattern). Nếu chưa có pattern, dùng `Test.createTestingModule` boot full module với test DB + Redis local.
- KHÔNG mock `safeHttpsFetch` ở integration — dùng test fixture image qua local HTTPS hoặc skip integration network (dùng small in-memory http server với self-signed cert? Phức tạp). **Đề xuất pragmatic**: integration test mock fetch layer, full DB + queue real.

## Requirements

### Functional Tests

#### Unit — `image-mirror.processor.spec.ts`
1. **Idempotency**: gọi `process({ chapterId: 1 })` 2 lần liên tiếp với mock DB query trả `[]` lần 2 → S3 PUT chỉ gọi 1 lần.
2. **Skip when no unmirrored**: query trả `[]` → return sớm, S3/sharp không gọi.
3. **Per-image error continues**: 3 images, image #2 download throw → image #1 và #3 vẫn mirror, DB update gọi 2 lần.
4. **DB update sets correct s3Url**: verify URL pattern `${publicUrl}/manga/{mangaId}/chapters/{chapterId}/{pageNumber}.webp`.

#### Unit — extend `chapter.service.spec.ts`
5. **Enqueue when needsMirror**: mock images với `imageUrl === sourceUrl` → expect `mirrorQueue.add` called once với `{ chapterId, jobId: 'chapter:X' }`.
6. **Skip enqueue when fully mirrored**: mock images với `imageUrl !== sourceUrl` → expect `mirrorQueue.add` NOT called.
7. **Skip enqueue when Redis down**: `redisStatus.available = false` → no add() call.
8. **Enqueue throw không 500 response**: mock `mirrorQueue.add` throw → `findOne` vẫn return chapter data, không propagate.

#### Integration — `tests/integration/mirror-flow.integration.spec.ts`
9. **End-to-end mirror flow**:
   - Seed manga + chapter + 3 chapter_images với `imageUrl = sourceUrl`.
   - Mock S3 + safeHttpsFetch (return tiny WebP buffer).
   - Boot full module với BullModule + MirrorModule + MangaModule.
   - Call `chapterService.findOne(chapterId)`.
   - Wait queue drain (`queue.waitUntilReady()` + worker complete event).
   - Assert: `chapter_images.imageUrl` updated to s3 URL pattern (3 rows).
   - Call `findOne` lần 2 → assert NO new job added (queue depth = 0).

### Non-Functional
- Tests deterministic (no flake from real network).
- Integration test < 5s.
- Coverage target: processor + new service branch ≥ 80%.

## Architecture

### Test boundaries

```
[Unit processor]    : mock DRIZZLE, S3Client, sharp; assert call counts + args
[Unit service]      : mock DRIZZLE chain, mirrorQueue.add, redisStatus; assert add() call shape
[Integration flow]  : real Drizzle (test DB), real BullMQ + Redis, mock fetch + S3
```

### Fixtures

- Tiny WebP buffer (~200 bytes) returned by mocked `safeHttpsFetch`.
- Test schema seed: 1 manga + 1 chapter + 3 chapter_images (sourceUrl populated, imageUrl = sourceUrl).

## Related Code Files

### Modify
- `backend/src/modules/manga/services/chapter.service.spec.ts` — extend providers + add 4 tests (#5-8).

### Create
- `backend/src/modules/mirror/image-mirror.processor.spec.ts` — 4 unit tests (#1-4).
- `backend/tests/integration/mirror-flow.integration.spec.ts` — 1 integration test (#9).

### Không đụng
- Other existing specs.
- `tests/setup.ts` (nếu cần extra setup, document riêng).

## Implementation Steps

1. **Extend `chapter.service.spec.ts`**
   - Import `REDIS_AVAILABLE` token.
   - Provider `'BullQueue_mirror'` (BullMQ injection token format) với `useValue: { add: vi.fn().mockResolvedValue({ id: 'mock' }) }`.
   - Provider `REDIS_AVAILABLE` với `useValue: { available: true }`.
   - Add 4 describe blocks for tests #5-8.

2. **Create `image-mirror.processor.spec.ts`**
   - Mock `S3Client.send`, mock `sharp` (return chainable mock với `.toBuffer()`).
   - Mock `safeHttpsFetch` (vi.mock module level).
   - Mock DRIZZLE chain để control unmirrored query results.
   - 4 tests #1-4.

3. **Create `mirror-flow.integration.spec.ts`**
   - Boot test module: `AppConfigModule`, `DrizzleModule` (test DB URL), `BullModule.forRootAsync` (real Redis), `MirrorModule`, `MangaModule`.
   - Mock `safeHttpsFetch` + `S3Client.send` ở module level.
   - Setup: seed test data via raw Drizzle.
   - Teardown: clear DB rows + clear Redis queue (`queue.obliterate({ force: true })`).
   - Assert post-flow DB state.

4. **Run**
   - `pnpm run test src/modules/mirror/image-mirror.processor.spec.ts`
   - `pnpm run test src/modules/manga/services/chapter.service.spec.ts`
   - `pnpm run test:e2e tests/integration/mirror-flow.integration.spec.ts` (hoặc unit config tùy setup integration)
   - All green, no flake (run 3x).

5. **Coverage check**
   - `pnpm run test:cov` → verify processor + service branches ≥ 80%.

## Todo List

- [ ] Update `chapter.service.spec.ts` providers thêm BullQueue mock + REDIS_AVAILABLE
- [ ] Test #5: enqueue khi needsMirror
- [ ] Test #6: skip enqueue khi fully mirrored
- [ ] Test #7: skip enqueue khi Redis down
- [ ] Test #8: enqueue throw không break response
- [ ] Create `image-mirror.processor.spec.ts`
- [ ] Test #1: idempotency (call 2 times, S3 once)
- [ ] Test #2: skip when no unmirrored
- [ ] Test #3: per-image error continues
- [ ] Test #4: DB update s3Url pattern correct
- [ ] Create `tests/integration/mirror-flow.integration.spec.ts`
- [ ] Test #9: end-to-end seed → findOne → drain queue → assert DB updated → findOne lần 2 no enqueue
- [ ] All tests pass `pnpm run test` + `pnpm run test:e2e`
- [ ] Coverage ≥ 80% cho processor + new service branch

## Success Criteria

- [ ] 4 unit tests processor pass (idempotent, skip-empty, error-continues, url-pattern).
- [ ] 4 new unit tests service pass (#5-8).
- [ ] 1 integration test pass (end-to-end flow + dedup).
- [ ] All existing tests still pass (no regression).
- [ ] No flaky tests (3 consecutive runs green).
- [ ] Coverage threshold met.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Integration test flake do Redis state leak | Med | Med | `queue.obliterate({ force: true })` + DB truncate trong afterEach |
| BullMQ injection token name khác `BullQueue_mirror` | Med | Low | Verify từ `@nestjs/bullmq` source hoặc dùng `getQueueToken('mirror')` helper |
| Real Redis required for integration → CI fail | High | High | CI config phải có Redis service (verify github actions workflow); fallback: skip integration trong CI nếu Redis unavailable, gate by env |
| Sharp mock không trigger correct chain | Low | Low | Use `vi.mock('sharp', () => ({ default: vi.fn(() => ({ resize: vi.fn().mockReturnThis(), webp: vi.fn().mockReturnThis(), toBuffer: vi.fn().mockResolvedValue(Buffer.from('x')) })) }))` |
| Worker không drain trong test timeout | Med | Med | Listen `queue.events.on('completed')` với promise + 3s timeout |

## Security Considerations

- Test fixtures KHÔNG dùng real S3 credentials (mock client).
- Test fixtures KHÔNG fetch real upstream URLs (mock `safeHttpsFetch`).
- Test DB URL từ env, không hardcode prod credentials.

## Next Steps

- Sau Phase 4 merge: deploy + manual smoke production (per report acceptance criteria).
- Monitor: queue depth, mirror latency, S3 PUT count, failed jobs count (logs only — Bull Board UI deferred).

## Rollback Plan

- Revert test commit — không impact runtime code.
- Code paths Phase 1-3 vẫn intact, chỉ mất safety net.

## Unresolved Questions

- CI có Redis service sẵn không? (Cần verify `.github/workflows/*.yml`. Nếu không, integration test phải gate bằng env hoặc setup Redis service trong workflow.)
- Test DB strategy — share schema với prod hay dedicated test schema? (Tham khảo existing integration tests pattern, nếu có. Defer setup nếu chưa có precedent.)
- BullMQ test mode (`new Queue('mirror', { connection: ..., skipVersionCheck: true })`) cần config riêng cho test? (Verify khi viết.)
