# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

ComicHub — manga/comic reading platform. Monorepo with NestJS backend + Next.js 16 frontend. Deployed on a single VPS via Docker Compose behind Cloudflare. Production: `https://zetsu.moe`.

## Repo Layout

```
comichub/
├── backend/    NestJS 11 + Drizzle + PostgreSQL + Redis  (see backend/CLAUDE.md)
├── frontend/   Next.js 16 + React 19 + Tailwind v4 + Radix  (see frontend/CLAUDE.md)
├── deploy/     deploy.sh, Caddy, docker compose entrypoints
├── docs/       architecture, code standards, deployment, security ops
└── plans/      active plan folders + reports/, visuals/, wireframes/
                (historical plans archived under plans/archive/)
```

When working in `backend/` or `frontend/`, the directory's own `CLAUDE.md` loads automatically — read it for stack-specific rules.

## Cross-Cutting Invariants

- **API prefix**: `/api/v1`. All backend routes live under it.
- **Response envelope**: `{ success, data, message }` — wrapped by backend `TransformInterceptor`, unwrapped by frontend `lib/api-client.ts`. Don't bypass either side.
- **Manga URL**: hybrid shortId-slug `/manga/{shortId}-{slug}` (e.g. `/manga/ZLYs-one-piece`).
  - Backend: `MangaService.findByIdentifier()` resolves both id-first and slug-fallback.
  - Frontend: build URLs via `getMangaUrl({ id, slug })`.
  - Legacy slug-only URLs still work — keep that compatibility.
- **Auth model**: JWT access + refresh + Google OAuth. Default-auth at the API; opt out with `@Public()`. Frontend uses Context (`useAuth`).
- **Brand**: repo name `ComicHub`, prod brand `zetsu.moe`. Brand strings are configurable — never hardcode display name.

## Workflow Rules

- Follow the plan/research/implement/test/review pipeline in `~/.claude/rules/primary-workflow.md`.
- Save new plans under `plans/{date}-{slug}/` (date format from `.ck.json`). Reports → `plans/reports/`.
- Active plans only at top level of `plans/`. Archive completed work to `plans/archive/`.
- Never create markdown outside `plans/` or `docs/` unless asked.
- Conventional commits, no AI references, never commit secrets.

## Documentation Map

| File | Purpose |
|---|---|
| `docs/system-architecture.md` | Topology, request pipeline, security baseline, caching, search |
| `docs/code-standards.md` | Conventions, module layout |
| `docs/design-guidelines.md` | UI spec — colors, typography, components |
| `docs/deployment-guide.md` | VPS deploy, rollback, ISR safety |
| `docs/security-operations.md` | Env checklist, secret rotation, incident response |
| `docs/project-changelog.md` | Release notes |
| `README.md` | Public-facing setup |
| `TODO.md` | Lightweight punch list (not the source of truth — plans are) |

When making changes that affect architecture, security posture, or deployment, update the corresponding `docs/` file in the same change.
