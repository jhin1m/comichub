# Reader Bars Tap-Toggle + First-Time Tip — Shipped

**Date:** 2026-05-03 10:55
**Severity:** Low
**Component:** Chapter reader (frontend)
**Status:** Resolved

## What Happened

Added single-tap gesture on mobile chapter reader (<768px) to toggle ẩn/hiện top + bottom bars. Replaces scroll-based auto-hide on mobile (kept on desktop). First-time users see Sonner toast tip "💡 Tip: Tap the image to hide/show the control bar." (5s, persisted via `localStorage` key `comichub:reader-tap-tip-seen`). Manual-mode swipe-to-paginate vẫn hoạt động song song.

Plan-driven 0.5d effort, two phases, both shipped clean. `pnpm run build` pass, code review 9/10 (zero CRITICAL/WARNING, 5 NIT optional).

## Implementation

**New hook** — `frontend/hooks/use-reader-tap-toggle.ts`
- Unified touch listener on scroll container; distinguishes tap vs swipe via thresholds:
  - Tap: `|dx|<10 && |dy|<10 && dt<250ms`
  - Swipe: `|dx|>50 && |dx|>|dy|`
- `[data-reader-control]` exclusion: tap on bars/buttons/zoom/caret container does NOT toggle.
- `passive: true` listeners; cleaned up on unmount.

**UI prop wiring** — bottom bar gains `hidden` prop with `translate-y-full` transition; top bar + zoom + caret container get `data-reader-control` attr.

**Integration** — `chapter-reader.tsx`:
- New `barsHidden` state, reset on chapter change.
- `useAutoHide` gated `!isMobile && !isManualMode` (desktop longstrip only).
- `topBarHidden = barsHidden || autoHideHidden` so manual toggle still works on desktop.
- Tip toast effect with `localStorage` flag, fires once per browser ever.

## Trade-Offs Picked

- **Single tap, not double-tap** — simpler, no zoom interference.
- **Mobile only** — desktop has hover/auto-hide; click-to-toggle would conflict with image selection.
- **`data-reader-control` attr** vs `e.target instanceof HTMLButtonElement` check — attr scales to non-button controls (caret container, future overlays).
- **Toast tip vs onboarding overlay** — Sonner already global, dismissible, non-intrusive. Overlay would be heavier and need its own dismiss UX.
- **Hook re-installs listeners on `readingDirection` change** — accepted; rarely changes, cheap.

## Risks Accepted

- Resize desktop→mobile mid-session fires tip once (acceptable single-fire).
- Tap false-positive khi user dừng tay rồi nhấc — accepted (tap threshold tight enough; user can tap again).
- `data-reader-control` on full-width caret container (`pointer-events-none`) means swipe ending exactly on a caret button drops the swipe. Edge-of-screen only; QA flag if reported.

## Lessons

- **Plan paid off**: brainstorm + 2-phase plan meant zero rework. The hook spec landed in phase-01, integration in phase-02, and code review found only NITs.
- **Component prop boundary cleanly drawn**: bottom bar takes `hidden`, doesn't know WHY. Parent owns gesture state. Easy to test, easy to extend (e.g. desktop click-to-toggle later).
- **Existing patterns reused**: Sonner already in `app/layout.tsx`, no new dependency. `useAutoHide` reused unchanged, just gated.

## Manual QA Pending

Build and review pass do NOT verify gesture behavior. Real-device manual checklist (in `phase-02-integration.md`) includes:
- Longstrip tap → bars ẩn / tap lại hiện
- Manual mode tap toggles + swipe paginates
- Tap on top bar / bottom bar / zoom / caret KHÔNG toggle
- Toast fires once on first reader open
- Chapter change resets bars to visible
- Desktop unchanged

Mobile gesture flakiness in Chrome DevTools emulation makes Playwright e2e low-value here — punted.
