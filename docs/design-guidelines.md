# ComicHub Design Guidelines

## Overview
Dark-first manga reader UI using Next.js 15 + @pxlkit/ui-kit (Tailwind CSS).
Pixel/retro aesthetic meets clean minimalism — built for long reading sessions.

---

## Color Tokens

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#0f0f0f` | Page background |
| `--bg-surface` | `#1a1a1a` | Cards, panels |
| `--bg-elevated` | `#242424` | Dropdowns, modals |
| `--bg-hover` | `#2e2e2e` | Hover states |
| `--accent` | `#e63946` | CTAs, highlights, active states |
| `--accent-hover` | `#c1121f` | Accent hover |
| `--accent-muted` | `#e6394620` | Accent backgrounds (badges) |
| `--text-primary` | `#f5f5f5` | Headings, primary text |
| `--text-secondary` | `#a0a0a0` | Meta, captions |
| `--text-muted` | `#5a5a5a` | Placeholders, disabled |
| `--border` | `#2a2a2a` | Card/input borders |
| `--border-accent` | `#e63946` | Active/focus borders |
| `--success` | `#2dc653` | Ongoing status |
| `--warning` | `#f4a261` | Hiatus status |
| `--info` | `#4895ef` | Info badges |

---

## Typography

```css
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
```

| Role | Font | Weight | Size Range |
|---|---|---|---|
| Display / Hero | Rajdhani | 700 | 48–72px |
| H1 | Rajdhani | 700 | 32–40px |
| H2 | Rajdhani | 600 | 24–28px |
| H3 | Rajdhani | 600 | 20–22px |
| Body | Inter | 400 | 14–16px |
| Caption / Meta | Inter | 400 | 12–13px |
| Button | Inter | 600 | 13–15px |
| Badge / Label | Inter | 600 | 11–12px (uppercase) |

Line height: 1.6 body, 1.2 headings. Letter-spacing: `0.05em` on uppercase labels.

---

## Spacing Scale (8px base grid)

`4 | 8 | 12 | 16 | 24 | 32 | 48 | 64 | 96 | 128`

Section padding: `py-16` (desktop) / `py-10` (mobile).
Card grid gap: `gap-4` (mobile) / `gap-6` (desktop).

---

## Manga Cover Cards (2:3 ratio)

```css
.manga-card {
  aspect-ratio: 2/3;          /* Standard manga cover */
  border-radius: 4px;          /* Subtle, not pill */
  overflow: hidden;
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  transition: transform 150ms ease, border-color 150ms ease;
}
.manga-card:hover {
  transform: translateY(-4px);
  border-color: #e63946;
}
```

Grid columns: 2 (mobile 320px) → 3 (480px) → 4 (768px) → 5 (1024px) → 6 (1280px).

---

## @pxlkit/ui-kit Component Mapping

| Use Case | Component | Tone |
|---|---|---|
| Primary CTA | PixelButton | `tone="danger"` |
| Secondary action | PixelButton | `tone="ghost"` |
| Chapter item | PixelCard | default dark |
| Genre tags | PixelBadge | `tone="default"` |
| Status (Ongoing) | PixelBadge | `tone="success"` |
| Status (Completed) | PixelBadge | `tone="info"` |
| Status (Hiatus) | PixelBadge | `tone="warning"` |
| Page tabs | PixelTabs | — |
| Chapter list nav | PixelPagination | — |
| Loading states | PixelSkeleton | — |
| Search input | PixelInput | — |
| Login form | PixelInput + PixelButton | — |
| User avatar | PixelAvatar | — |
| Confirm dialogs | PixelModal | — |

---

## Layout Breakpoints

| Name | Width | Columns |
|---|---|---|
| xs | 320px | 1 (stack) |
| sm | 480px | 2 |
| md | 768px | 3–4 |
| lg | 1024px | 4–5 |
| xl | 1280px | 5–6 |
| 2xl | 1440px+ | 6 |

Max content width: `1400px`, centered with `mx-auto px-4 md:px-6 lg:px-8`.

---

## Component Patterns

### Navbar
- Height: 64px desktop / 56px mobile
- Background: `#0f0f0f` + `border-bottom: 1px solid #2a2a2a`
- Logo: Rajdhani 700, `#e63946` accent color on "Hub"
- Sticky on desktop, hide-on-scroll on mobile

### Hero Banner
- Full-width, height 480px desktop / 260px mobile
- Blurred cover image background + dark overlay `rgba(0,0,0,0.7)`
- Featured manga info overlay (bottom-left)
- Gradient: `linear-gradient(to right, rgba(0,0,0,0.9) 40%, transparent)`

### Chapter Reader
- Max width: 800px centered
- Background: `#000000` (pure black for immersion)
- Images: `width: 100%`, lazy loaded, no gaps between pages
- Controls: floating top bar, opacity 0 → 1 on hover/tap
- Long-press / tap-right: next chapter

### Forms (Auth)
- Max width: 420px card, centered on page
- Input height: 44px (min touch target)
- Error states: `#e63946` border + message below

---

## Motion & Micro-interactions

- Card hover: `transform translateY(-4px)` + border accent, `150ms ease`
- Page transitions: fade `200ms`
- Skeleton: `animate-pulse` via pxlkit PixelSkeleton
- Button active: `scale(0.97)` `100ms`
- Chapter image load: fade-in `300ms`
- Respect `prefers-reduced-motion: reduce` — disable transforms

---

## Accessibility

- Color contrast: all text meets WCAG AA (4.5:1 normal, 3:1 large)
- Focus rings: `outline: 2px solid #e63946; outline-offset: 2px`
- Touch targets: min 44×44px
- Images: `alt` text always provided
- Keyboard nav: all interactive elements reachable
- ARIA labels on icon-only buttons

---

## Asset Conventions

- Cover images: WebP, max 300KB, lazy loaded, `srcset` for retina
- Icons: Lucide React (consistent stroke weight 1.5px)
- SVG favicons + OG images per manga

---

## Frontend Implementation Status

**Completed:** Next.js 16 frontend with full Tailwind CSS v4 support and @pxlkit/ui-kit components.

**Location:** `/frontend/` directory
**Tech Stack:** Next.js 16 | TypeScript | Tailwind CSS v4 | @pxlkit/ui-kit | Lucide React | axios
**Build Status:** `pnpm build` passes with zero errors

**Pages Implemented:**
- Home (hero + popular + latest + genre filters)
- Browse (advanced filters, pagination, responsive grid)
- Manga Detail (cover hero, metadata, chapter list with search)
- Chapter Reader (vertical image scrolling, progress bar, toolbar, nav)
- Auth (login, register, Google OAuth callback)
- Profile (user info, history, follows tabs)

**Key Features:**
- Server-side rendering for home/detail pages
- Client-side state management for filters and reader
- JWT auto-refresh with request queue
- Optimistic UI for follow toggles
- S3 image support via remotePatterns config
- Reading history auto-tracking for authenticated users
- Responsive mobile-first design (2→6 column grids)
- Auto-hiding toolbar in reader mode
