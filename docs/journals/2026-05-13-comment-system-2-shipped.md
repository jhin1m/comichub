# Comment System 2.0: Shipped 7 Days, 3 Critical Fixes Mid-Flight

**Date**: 2026-05-13 10:45  
**Severity**: High (shipped successfully, but code review caught systemic trust issues)  
**Component**: Backend comment service, moderation, reports, admin, SSE real-time  
**Status**: Resolved and shipped

## What Happened

Shipped Comment System 2.0 on schedule — all 7 phases implemented end-to-end over 7 days. Schema migrations (Drizzle), @mention parser + FE autocomplete, comment reports + admin queue, pin (max 3 FIFO), edit history snapshots (max 10), OpenAI moderation with graceful fallback (no key → auto-approve), SSE real-time stream with visibility-aware filtering, and FE polish (removed image button, Write/Preview tabs). Backend: 537 tests passing. Frontend: 166 tests passing. Both TS + lint clean.

Code review then surfaced 3 **HIGH** correctness issues — all fixed before merge. Ship was solid mechanically, but the code review catch rate was uncomfortably high for mid-sized feature work.

## The Brutal Truth

This is frustrating because the implementation felt complete. All phases passed local tests, the plan was clear, and the schedule held. But the code review found three separate trust violations that would have broken the integrity guarantees:

1. **Users could bypass moderation by editing** — post benign comment, wait for approval, then edit to slur/spam with zero re-check. That's a silent vulnerability.
2. **Pin race condition** — two admins pinning concurrently could exceed the 3-per-manga cap, making the enforcement meaningless.
3. **Mention parser shared regex across requests** — concurrent requests would mutate `lastIndex`, causing inconsistent mention detection across users.

These aren't edge cases or polish issues; they're **data integrity and security gaps**. The fact they made it past unit tests and into code review is the real problem. We're not testing at the concurrency level or the attack-surface level.

## Technical Details

**Edit moderation bypass:** `comment.service.ts:578` directly updated `content` without re-emitting the `comment.created` event. The moderation listener never re-evaluated the new content. Fix: reset `moderationStatus` to pending and re-emit `comment.created` on edit (with moderation enabled).

**Pin FIFO race:** `comment.service.ts:786-822` checked `pinned.length >= 3` and auto-released the oldest, all inside a transaction. But a transaction-only lock doesn't prevent two concurrent transactions from both passing the check simultaneously. Fix: wrapped the pin logic with `pg_advisory_xact_lock(hashtext(...))` to serialize concurrent pins per (commentableType, commentableId).

**Regex shared state:** `comment-mention.service.ts` declared a regex at module level and reused it in a loop, mutating `lastIndex`. Concurrent requests stepping through the same regex object could skip or double-count matches. Fix: moved regex declarations inside the method.

## What We Tried

- Drizzle migrations: first attempted prompts via `drizzle-kit`, but the environment doesn't support TTY. Switched to hand-written SQL.
- Concurrent GIN index creation: split into migration 0023 (no transaction) per project convention.
- OpenAI integration: used `fetch` instead of SDK to avoid new dependency; graceful fallback on timeout/error (5s threshold, then auto-approve).
- Moderation event listener: made it async so comment insert never blocks; flag is best-effort.
- SSE reconnect: Page Visibility API integration to drop connections when tab hidden, reconnect on focus (reduces wasted heartbeats).

All of these worked. The moderation logic, the real-time stream, the permission-based filtering — solid. The **surprise** was that systems working well at the unit level didn't guarantee correctness at the concurrency or attack-surface level.

## Root Cause Analysis

The root cause is **insufficient adversarial testing**. Unit tests pass because:
- They mock the database and don't run concurrent transactions.
- They don't simulate post-approve-then-edit attack patterns.
- The regex race wasn't triggered because test data was small and serial.

The real-world deployment would hit these immediately:
- Users naturally edit comments after posting.
- Admins do pin comments simultaneously during moderation.
- SSE subscribers cause enough request volume that regex races occur.

We need **integration tests with transaction isolation** and **stress testing for concurrency primitives** (locks, transactions). Mocking the database in unit tests hides real bugs.

## Lessons Learned

1. **Concurrency is not optional.** Any feature touching shared state (pins, moderation flags, mention parsing) needs explicit concurrency tests, not just unit mocks. Run transaction isolation levels explicitly.

2. **Graceful fallback is fine for UX, not for correctness.** OpenAI moderation failing gracefully (auto-approve) is correct; a post-hoc edit bypassing moderation forever is a correctness bug.

3. **Code review at concurrency density matters.** The reviewers caught these because they asked "what if two requests happen simultaneously?" That question needs to be in the checklist for features touching shared mutable state.

4. **Regex in shared scope is a code smell.** If a regex appears in a method that's called in a loop (or concurrently), the `lastIndex` mutation is a landmine. Easier to just declare inside.

5. **Edit is not a free operation.** When content changes in a moderated system, the moderation state must re-evaluate. It's not just a field update; it's a state machine transition.

## Next Steps

1. **Merge the fixes immediately.** All 3 HIGH issues are resolved in code review and in the repo now.
2. **Add concurrency test suite.** Create `integration/concurrency.spec.ts` — test pin races, edit+moderation races, SSE multi-instance edge cases.
3. **Document the implicit contract.** In `comment.service.ts`, add a comment block: "Any field mutation that affects moderation state (content, mentions) must re-trigger moderation." Same for "Pin operations must serialize."
4. **Stress test before next deploy.** Run a quick load test with concurrent comment edits + admin pins before staging.
5. **Track package deferral:** `@tiptap/extension-mention` + `tippy.js` — slot into v2.1 intake.

The feature shipped on time with good test coverage. The code review catch prevented a production security/data-integrity incident. That's the system working, but it's a reminder that shipping on time and shipping correctly sometimes require different test strategies.
