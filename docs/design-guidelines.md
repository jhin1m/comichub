# ComicHub Design Guidelines

## Overview

Dark-only manga reader UI — Next.js 16 + Radix UI primitives + Tailwind CSS v4.
Clean dark aesthetic for long reading sessions. No light mode.

**Stack:** Next.js 16 | TypeScript | Tailwind CSS v4 | Radix UI | Lucide React | sonner | zod + react-hook-form | axios

---

## Color Tokens

**RULE: Always use CSS variables or Tailwind theme classes. Never hardcode hex values in components.**

| Token | Hex | Tailwind Class | Usage |
|---|---|---|---|
| `--bg-base` | `#0f0f0f` | `bg-base` | Page background |
| `--bg-surface` | `#1a1a1a` | `bg-surface` | Cards, panels |
| `--bg-elevated` | `#242424` | `bg-elevated` | Dropdowns, modals |
| `--bg-hover` | `#2e2e2e` | `bg-hover` | Hover states |
| `--accent` | `#e63946` | `bg-accent` / `text-accent` | CTAs, highlights, active states |
| `--accent-hover` | `#c1121f` | `bg-accent-hover` | Accent hover |
| `--accent-muted` | `#e6394620` | `bg-accent-muted` | Accent backgrounds (badges) |
| `--text-primary` | `#f5f5f5` | `text-primary` | Headings, primary text |
| `--text-secondary` | `#a0a0a0` | `text-secondary` | Meta, captions |
| `--text-muted` | `#5a5a5a` | `text-muted` | Placeholders, disabled |
| `--border` | `#2a2a2a` | `border-default` | Card/input borders |
| `--border-accent` | `#e63946` | `border-accent` | Active/focus borders |
| `--success` | `#2dc653` | `text-success` / `bg-success` | Ongoing status |
| `--warning` | `#f4a261` | `text-warning` / `bg-warning` | Hiatus status |
| `--info` | `#4895ef` | `text-info` / `bg-info` | Info badges |

**Tailwind theme setup** in `globals.css`:
```css
@theme inline {
  --color-base: #0f0f0f;
  --color-surface: #1a1a1a;
  --color-elevated: #242424;
  --color-hover: #2e2e2e;
  --color-accent: #e63946;
  --color-accent-hover: #c1121f;
  --color-accent-muted: #e6394620;
  --color-primary: #f5f5f5;
  --color-secondary: #a0a0a0;
  --color-muted: #5a5a5a;
  --color-success: #2dc653;
  --color-warning: #f4a261;
  --color-info: #4895ef;
}
```

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

## Icon Standards (Lucide React)

Stroke weight: 1.5px (Lucide default). Three standard sizes:

| Size | px | Tailwind | Usage |
|---|---|---|---|
| `sm` | 14 | `size={14}` | Inline with text, badges, metadata |
| `md` | 18 | `size={18}` | Buttons, toolbar actions, nav items |
| `lg` | 24 | `size={24}` | Standalone, empty states, hero elements |

**Rules:**
- Icon-only buttons MUST have `aria-label`
- Always pair icon + text for primary actions; icon-only for secondary/toolbar
- Color inherits from parent text color — don't set icon color separately

---

## UI Components (Radix UI + Tailwind)

### Philosophy
Use **Radix UI primitives** for behavior (accessibility, keyboard nav, focus management).
Style with **Tailwind CSS classes**. No CSS-in-JS, no component libraries.

### Component Directory
All shared UI components live in `frontend/components/ui/`. Each wraps a Radix primitive with project styling.

| Component | Radix Primitive | Purpose |
|---|---|---|
| `button.tsx` | — (native) | Primary, secondary, ghost, danger variants |
| `badge.tsx` | — (native) | Status, genre, info badges |
| `input.tsx` | — (native) | Text input with label, error state |
| `select.tsx` | `@radix-ui/react-select` | Styled dropdown select |
| `dialog.tsx` | `@radix-ui/react-dialog` | Modal dialogs with backdrop |
| `tabs.tsx` | `@radix-ui/react-tabs` | Tab navigation |
| `dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` | Context/action menus |
| `tooltip.tsx` | `@radix-ui/react-tooltip` | Hover tooltips |
| `skeleton.tsx` | — (native) | Loading placeholder with pulse animation |
| `pagination.tsx` | — (native) | Page navigation |
| `avatar.tsx` | `@radix-ui/react-avatar` | User avatar with fallback initials |

### Button Variants

```tsx
// variants: "primary" | "secondary" | "ghost" | "danger"
// sizes: "sm" | "md" | "lg"
<Button variant="primary" size="md">Follow</Button>
<Button variant="ghost" size="sm"><Search size={14} /> Search</Button>
```

| Variant | Background | Text | Border | Hover |
|---|---|---|---|---|
| `primary` | `bg-accent` | `text-white` | none | `bg-accent-hover` |
| `secondary` | `bg-surface` | `text-primary` | `border-default` | `bg-hover` |
| `ghost` | transparent | `text-secondary` | none | `bg-hover` |
| `danger` | `bg-red-600` | `text-white` | none | `bg-red-700` |

All buttons: `font-semibold`, min height 36px (sm) / 40px (md) / 44px (lg), `rounded-md`, disabled state `opacity-40 cursor-not-allowed`.

### Badge Variants

| Variant | Usage | Style |
|---|---|---|
| `default` | Genre tags | `bg-surface border-default text-secondary` |
| `success` | Ongoing status | `bg-success/20 text-success` |
| `warning` | Hiatus status | `bg-warning/20 text-warning` |
| `info` | Completed status | `bg-info/20 text-info` |
| `accent` | Featured/hot | `bg-accent-muted text-accent` |

---

## UX States

### Loading States

| Context | Pattern | Implementation |
|---|---|---|
| Grid/list data | Skeleton cards | `<Skeleton className="aspect-2/3 w-full rounded" />` |
| Inline action | Spinner inside button | `<Loader2 className="animate-spin" size={14} />` |
| Full page | Skeleton layout matching target | Compose skeletons matching page structure |
| Button submit | Disable + spinner + text change | `isLoading ? "Saving..." : "Save"` |

**Rules:**
- Skeletons MUST match target layout shape (aspect ratio, height, spacing)
- Never show raw spinner for content areas — use skeletons
- Spinner only for inline/button actions

### Error States

| Context | Pattern |
|---|---|
| Form field | Red border + error text below input (from react-hook-form) |
| Form submit | Inline error message above/below submit button |
| API failure (transient) | **sonner toast** — `toast.error("message")` |
| API failure (blocking) | Error component with retry button |
| 404 / not found | Dedicated error page |

**Rules:**
- Form errors: show per-field from zod validation, clear on re-type
- Toast for transient feedback only (saved, copied, followed, error)
- Never use `alert()` or `window.confirm()`

### Empty States

Consistent pattern for all empty data views:

```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <IconComponent size={48} className="text-muted mb-4" />
  <p className="text-secondary text-sm mb-2">No chapters found</p>
  <p className="text-muted text-xs">Optional helpful hint</p>
  {/* Optional CTA button */}
</div>
```

**Rules:**
- Always show an icon (Lucide, `size={48}`, `text-muted`)
- Primary message in `text-secondary`, hint in `text-muted`
- Optional CTA button for actionable empty states (e.g., "Browse manga")
- Never return `null` for empty data — always show empty state

### Success States

- Use **sonner toast**: `toast.success("Followed successfully")`
- Auto-dismiss after 3s
- Position: `top-right` on desktop, `top-center` on mobile

---

## Toast Notifications (sonner)

```tsx
// Setup in layout.tsx
import { Toaster } from 'sonner';
<Toaster position="top-right" theme="dark" richColors />

// Usage
import { toast } from 'sonner';
toast.success("Added to library");
toast.error("Failed to follow");
toast.loading("Uploading...");
```

**When to toast:**
- Follow/unfollow, rating, report submit (success/error)
- Clipboard copy, share actions
- API errors not tied to a specific form field

**When NOT to toast:**
- Form validation errors → inline per-field
- Loading data → skeleton
- Navigation feedback → page transition

---

## Forms (zod + react-hook-form)

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Min 6 characters"),
});

const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
  resolver: zodResolver(schema),
});
```

**Rules:**
- All forms use zod schemas for validation
- Show errors on blur + submit (not on every keystroke)
- Submit button disabled while `isSubmitting`
- Submit button shows spinner + "Submitting..." text while loading
- Max form width: `420px`, centered
- Input height: min `44px` (touch target)
- Error text: `text-accent text-xs mt-1` below the field

---

## Modal / Dialog (Radix Dialog)

```tsx
import * as Dialog from '@radix-ui/react-dialog';

<Dialog.Root>
  <Dialog.Trigger asChild><Button>Report</Button></Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50" />
    <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-surface border border-default rounded-lg w-full max-w-md mx-4 p-6">
      <Dialog.Title className="font-rajdhani font-bold text-lg">Title</Dialog.Title>
      {/* content */}
      <Dialog.Close asChild><button aria-label="Close">X</button></Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

**Rules:**
- Always use Radix Dialog — never manual fixed divs
- Overlay: `bg-black/70`
- Content: `bg-surface border-default rounded-lg`
- Must have `Dialog.Title` for accessibility
- Close on overlay click (Radix default)
- Trap focus inside dialog (Radix default)

---

## Manga Cover Cards (2:3 ratio)

```tsx
<div className="group relative aspect-2/3 overflow-hidden rounded bg-surface border border-default
  transition-transform duration-150 ease-out hover:-translate-y-1 hover:border-accent">
  <Image src={cover} alt={title} fill className="object-cover" sizes="..." loading="lazy" />
</div>
```

Grid columns: 2 (mobile 320px) → 3 (480px) → 4 (768px) → 5 (1024px) → 6 (1280px).

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

## Responsive Behavior

### Navigation
- **Desktop (md+):** Full navbar with links, search bar, user dropdown
- **Mobile (<md):** Hamburger → dropdown menu panel. Search icon → full-width search overlay

### Content Layout
- **Desktop:** Side-by-side layouts (cover + info, sidebar + main)
- **Mobile:** Stacked, full-width. Sidebar content moves below main

### Interactive Elements
- **Desktop:** Hover tooltips, dropdown menus on click
- **Mobile:** No hover states. Tap-only. Modals instead of dropdowns where needed
- Touch targets: min 44×44px on all interactive elements

---

## Component Patterns

### Navbar
- Height: 56px (h-14)
- Background: `bg-base` + `border-b border-default`
- Logo: Rajdhani 700, accent color on "Hub"
- Sticky on all viewports

### Manga Detail Hero
- Full-width section with `border-b border-default` separator
- **Blurred backdrop**: Cover image with `blur-3xl scale-125 opacity-20`, layered gradients:
  - `bg-gradient-to-r from-base via-base/95 to-base/80`
  - `bg-gradient-to-t from-base via-transparent to-base/60`
- Content constrained to `max-w-[1400px]` with standard page padding
- Layout: `grid grid-cols-1 lg:grid-cols-[1fr_320px]` — cover+info left, sidebar right
- Cover: `rounded-lg` + `shadow-2xl shadow-black/50` for depth against backdrop
- **Action buttons**: All use `Button` component, consistent `h-10` height
  - Start Reading: `variant="primary"` with filled `Play` icon
  - Follow: `variant="secondary"` with `Bookmark`/`BookmarkCheck` icon
  - Report: `variant="secondary"` icon-only with `AlertTriangle` icon
- **Stats row**: Inline icons (Eye, Users, BookOpen) with `text-secondary`, `text-sm`
- Genre tags displayed in hero via `MangaGenres` component
- Mobile: centered stacked layout with smaller cover (w-48 h-72)

### Chapter Reader
- Max width: 800px centered
- Background: `#000000` (pure black)
- Images: `width: 100%`, lazy loaded, no gaps
- Controls: floating top bar, fade on hover/tap
- Image load: fade-in `opacity-0 → opacity-100` over `300ms`

---

## Image Handling

| Context | Pattern |
|---|---|
| Manga covers | `<Image fill sizes="..." loading="lazy" />` with aspect-2/3 container |
| Reader pages | `<img>` with `unoptimized`, fade-in on load |
| Missing cover | Fallback div: `bg-surface text-muted text-sm` centered "No Cover" |
| Avatar | Radix Avatar with fallback initials |

**Rules:**
- Always provide `sizes` attribute for responsive images
- Always provide meaningful `alt` text
- Use Next.js `<Image>` for covers/thumbnails, native `<img>` only for reader (unoptimized)
- Fallback: never show broken image icon — always a styled placeholder

---

## Motion & Micro-interactions

- Card hover: `-translate-y-1` + `border-accent`, `150ms ease-out`
- Page transitions: fade `200ms`
- Skeleton: `animate-pulse` (Tailwind built-in)
- Button active: `active:scale-[0.97]` `100ms`
- Chapter image load: fade-in `300ms`
- Toast: slide-in from top-right (sonner default)
- `prefers-reduced-motion: reduce` — disable transforms, keep opacity transitions

---

## Accessibility

- Color contrast: WCAG AA (4.5:1 normal, 3:1 large)
- Focus rings: `outline-2 outline-accent outline-offset-2`
- Touch targets: min 44×44px
- Images: `alt` text required
- Keyboard nav: all interactive elements focusable + operable
- Icon-only buttons: `aria-label` required
- Modals: focus trap + `aria-labelledby` (Radix handles this)
- Form errors: `aria-invalid` + `aria-describedby` linking to error message

---

## Asset Conventions

- Cover images: WebP, max 300KB, lazy loaded
- Icons: Lucide React, stroke 1.5px, 3 sizes (14/18/24)
- SVG favicons + OG images per manga

---
