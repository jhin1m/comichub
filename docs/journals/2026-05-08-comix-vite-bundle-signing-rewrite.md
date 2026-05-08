# Comix.to Signing Rewrite — 7-Hour Import Outage Resolved

**Date**: 2026-05-08 08:30–16:45 UTC
**Severity**: Critical (automated chapter ingestion blocked)
**Component**: Backend import signing (comix-sign.ts, comix-import.ts, import-utils.ts)
**Status**: Code complete (Phase 03 deploy pending)

## What Happened

Comix.to migrated their frontend bundler from Next.js + Turbopack to Vite + rolldown overnight. Our hourly cron stopped signing requests — all chapter imports returned HTTP 403 "Invalid token" for 7+ hours.

Root cause: the secure signing module (`secure-*.js`) both changed location in the bundle and altered its algorithm (different cipher key initialization order, new lookup patterns). Our signer, which was built to vm-eval the Next.js output, couldn't locate or execute the Vite output.

Incident: 09:00–16:00 UTC. All imports blocked. No chapters ingested across the entire platform for the outage window.

**Resolution**: Rewrote `/backend/src/scripts/comix-sign.ts` + supporting utils to probe the live bundle, extract keys dynamically, execute the cipher in isolation via vm2, and handle 403→retry with auto-recovery. Commit `6239e91e` on main (+396 lines / −373 lines across 3 files). Phase 03 (deploy to VPS) remaining.

## The Brutal Truth

This was a *stupid* assumption we made: "the endpoint shape won't change, so the signing module structure won't either." Wrong. Comix.to refactored their entire bundler, and we paid for it by blind-spot debugging.

The really maddening part? The HakuNeko reference code we'd built against was stale. Their cipher had a different round order and different key array than what we'd reverse-engineered. We spent 2 hours running the old algorithm against live bundle output, getting 403s, and wondering if we'd misunderstood the math. Turned out the math was right — we were just reading old code.

The anti-tamper trap in their bundle (`ce()` function probing `document.querySelector.toString()` against native-code regex) was the final gut-punch: if the probe failed, the keys silently scrambled. So you'd execute the "correct" algorithm, get garbage output, and the API would 403 with NO signal that the anti-tamper fired. This is the kind of hidden trap that doubles your debugging time.

## Technical Details

### What Broke

1. **Bundle location shift**: Turbopack emitted secure module into a predictable chunk (`secure-*.js`). Vite/rolldown inlined it directly into `_next/static/chunks/[...].js` or bundled it as a separate asset we couldn't locate.
2. **Cipher key initialization reordered**: New bundle uses 3 rounds of XOR + shift (not 2). Key arrays loaded in different order.
3. **Lookup table schema changed**: Older bundle had `termIds` as arrays on manga response. New bundle only includes term IDs on `/mangaSlug/detail` endpoint and uses them differently — no longer a simple array, requires cross-referencing.

### What We Tried

**Attempt 1: Patch the old signer with new key offsets**
- Parsed live bundle via regex, extracted keys, fed them to our Turbopack-era decryption logic.
- Got 403s consistently. Suspected math was wrong.
- **Why it failed**: Turbopack and Vite use different obfuscation. Round order and XOR/shift sequence entirely different. Regex offsets pointed to the right bytes but wrong function context.

**Attempt 2: Use HakuNeko's ComixTo.ts as the source of truth**
- HakuNeko is a popular scraper; presumably their signing algo would match comix.to's.
- Ported their cipher logic directly.
- **Why it failed**: HakuNeko's code is stale (~2 commits old from their repo). Their keys and round order diverged from production. We got different output; still 403s.

**Attempt 3: VM-eval the live secure module, spoof querySelector, capture output**
- Extracted the secure function from the bundle.
- Created an isolated vm2 context with a spoofed `document` object and native-code-compliant `querySelector` stub.
- Ran the cipher inside the VM, captured the returned signed token.
- **This worked**: Output matched what the browser would produce. 200 OK on actual API requests.

### Key Implementation Decisions

**Dynamic key discovery via probe**: Instead of hardcoding offsets, we now probe the live bundle on 403. Regex patterns match function signatures (not byte values), so Vite/rolldown/future bundlers stay compatible as long as the function shape doesn't change.

```typescript
// Old: hardcoded offsets for Turbopack
const keys = [bundleStr.slice(12543, 12575), bundleStr.slice(12576, ...)];

// New: pattern-match the secure function, extract keys from its internals
const secureMatch = bundleStr.match(/function\s+\w+\s*\(\w+\)\s*\{[\s\S]*?return\s+/);
// Extract keys from the function body via more robust parsing
```

**Hybrid metadata fetch strategy**: New schema only returns term IDs on `/mangaSlug/detail`, not `/manga/page/N`. Our lookup table rebuild now:
1. Fetch `/manga/page/1` (9 manga) → no term IDs, store as-is.
2. When processing each manga, immediately fetch `/mangaSlug/detail` (lazy, in parallel) to backfill term IDs.
3. This doubled endpoint calls per manga but avoided redesigning the entire import loop.

**Reset-on-403 pattern**: When signing returns 403, we call `resetSigner()` which clears cached keys, then retry once. This handles bundle rotation without human intervention.

```typescript
const isRetryable = (statusCode: number): boolean => {
  // CRITICAL FIX: 403 wasn't in the original list
  return [429, 503, 504, 403].includes(statusCode);
};
```

### Code Review Catches (8.0/10)

Reviewer surfaced two real bugs the smoke test missed:

**C1: 403→retry chain broken**
- Smoke test only ran happy-path (fresh signer in cache).
- If a request returned 403, `isRetryable` check didn't include 403, so we never reset the signer or retried.
- Result: any bundle rotation in production → hard fail, no auto-recovery.
- **Fixed**: Added 403 to `isRetryable` list. Now 403 → resetSigner() → retry once.

**C2: Chapter dedup query missing source filter**
```sql
-- Before (BUG)
SELECT id FROM chapters 
WHERE externalId = $1

-- After (FIXED)
SELECT id FROM chapters 
WHERE externalId = $1 AND source = $2
```
- If Comix and another source share the same `externalId` (unlikely but possible), old query would return the wrong chapter.
- Would silently drop chapters on insert conflict.
- **Impact**: Low probability, but data corruption if hit.

Both bugs would have shipped to prod without code review. Smoke test doesn't cover edge cases.

## Root Cause Analysis

**Primary**: We treated the comix.to integration as stable infrastructure ("they won't refactor their bundler"). They did. No notification, no API versioning, just a hard break.

**Secondary**: Our reference implementation (HakuNeko) was stale. Never assume scraper code is current; always validate against live output.

**Tertiary**: Anti-tamper probes (`toString()` checks) are common but easy to miss when reading obfuscated code. The secure module's tamper check was small (~10 lines) and buried in the middle of 28KB of minified code. We only found it during deep reverse-engineering after the first two attempts failed.

## Lessons Learned

1. **Read the source, not just the spec**: When reverse-engineering obfuscated bundles, extract and beautify the actual code first. Regex patterns and byte offsets are fragile. Function structure is durable.

2. **Smoke tests + code review are not redundant — they catch different bugs**: Smoke test validates happy-path (request succeeds, response parsed). Code review validates failure modes (403 handling, edge-case queries). Both required.

3. **"API stayed the same, schema didn't change" is rarely true**: Always probe actual responses before committing field mappings. The `/manga/page/N` response still returned the same fields, but term IDs moved to a different endpoint. Metadata fetch strategy had to pivot.

4. **Throwaway probe scripts save hours**: Three short Node.js mjs files in `/tmp` let us iterate on cipher + sandbox logic before committing. Clean up after. Better than integration tests for one-off reverse-engineering.

5. **Anti-tamper via toString() probes is a common pattern**: If a cipher function doesn't output what you expect, check if it's probing the runtime environment. Spoof it; run the cipher in isolation via vm with a mock `document`.

## Next Steps

**Phase 03 (Deploy to VPS)** — User action:
- Pull commit `6239e91e` on production VPS
- Restart hourly cron job (`systemctl restart comichub-import`)
- Monitor first 3 runs: `tail -f /var/log/comichub-import.log`
- If 200 OK on chapter endpoints, incident resolved
- If 403 persists: re-probe the bundle (signer auto-discovers on next 403)

**Monitoring**: Add Prometheus metric `comix_signing_failures_total` (counter incremented on 403, reset on successful recovery) to catch future rotations faster.

**Hardening** (post-incident, not blocking deploy):
- Add unit tests for vm-eval cipher isolation (currently smoke-tested only)
- Consider mirroring the bundle locally on startup to detect format changes early
- Add detailed logging of probe regex matches so future engineers can debug bundle changes without blind reverse-engineering

---

**Unresolved Questions**:
- Is `chapterUpdatedAtFormatted` ever absolute (ISO 8601), or always relative ("2h ago")? Response varies by endpoint; need to verify term ID backfill endpoint behavior.
- What is the bundle hash rotation cadence empirically? (Currently auto-discovered on 403; nice to know if it's daily/weekly.)
