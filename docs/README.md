# ComicHub Documentation

Welcome to the ComicHub Backend API documentation. This directory contains comprehensive guides for developers, architects, and stakeholders.

## Quick Start

**New Developer?** Start here:
1. Read [Project Overview & PDR](./project-overview-pdr.md) for context
2. Review [Code Standards](./code-standards.md) for conventions
3. Check [Codebase Summary](./codebase-summary.md) for file locations
4. Explore [System Architecture](./system-architecture.md) for how it works

**Architect/Lead?** Start here:
1. Read [Project Overview & PDR](./project-overview-pdr.md) — requirements, roadmap, risks
2. Review [System Architecture](./system-architecture.md) — data flow, middleware, security
3. Check [Tech Stack](./tech-stack.md) — dependencies and versions

## Documentation Files

### [Project Overview & PDR](./project-overview-pdr.md)
**For:** Stakeholders, leads, strategic planning
**Contains:**
- Executive summary & vision
- Functional & non-functional requirements
- Acceptance criteria (all Phase 1 met ✓)
- Architecture decisions with rationale
- Risk assessment & mitigation
- 4-phase roadmap (Q2-Q4 2026)
- Unresolved questions for Phase 2
- Success metrics & KPIs

**Read Time:** 15 min | 417 LOC

### [System Architecture](./system-architecture.md)
**For:** Architects, senior developers, API designers
**Contains:**
- Request flow with middleware pipeline (ASCII diagram)
- Module structure & dependencies
- Data flow walkthrough examples
- Error handling patterns
- Database connection lifecycle
- Middleware & guards table
- Security considerations
- Performance guidelines
- Testing architecture

**Read Time:** 10 min | 260 LOC

### [Code Standards](./code-standards.md)
**For:** All developers (reference during implementation)
**Contains:**
- File naming conventions
- Directory structure templates
- TypeScript strict mode rules
- NestJS conventions & patterns
- DTO validation examples
- Error handling standards
- Decorator & guard usage
- Testing structure & coverage
- ESLint & Prettier config
- Database (Drizzle) patterns
- Security best practices
- Commit message format
- Phase 2 tasks checklist

**Read Time:** 20 min | 442 LOC

### [Codebase Summary](./codebase-summary.md)
**For:** Quick reference, onboarding
**Contains:**
- Complete directory structure
- Key files & purposes
- Response format documentation
- Error handling patterns
- Tech stack summary
- Phase 1 completion checklist
- Phase 2 preview

**Read Time:** 5 min | 141 LOC

### [Tech Stack](./tech-stack.md)
**For:** Dependency reference, decisions
**Contains:**
- Runtime & language specs
- Framework & architecture
- Database & ORM
- Authentication & authorization
- Key packages table
- Infrastructure services
- Testing framework
- Code quality tools

**Read Time:** 2 min | 52 LOC

---

## Phase Status

**Phase 1: Project Setup & Scaffolding** ✅ COMPLETE
- NestJS bootstrap with Swagger
- Configuration management system
- Drizzle ORM integration
- Middleware, guards, filters, interceptors
- Common utilities & decorators
- Test infrastructure (Vitest)
- All 14 acceptance criteria met

**Phase 2: User Management & Database Schema** (Planned Q2 2026)
- Database schema (users, manga, chapters)
- User authentication (JWT + Passport)
- User CRUD endpoints
- Manga/comic CRUD endpoints
- Integration tests

**Phase 3: Core Features** (Planned Q3 2026)
- Chapter reading endpoints
- Bookmark & progress tracking
- Social features (ratings, reviews)
- Search & filtering

**Phase 4: Advanced Features** (Planned Q4 2026)
- Image upload & optimization (S3)
- Caching layer (Redis)
- Admin dashboard
- Analytics

---

## Development Workflow

### Local Setup
```bash
cp .env.example .env
# Edit .env with your database URL

pnpm install
pnpm start:dev
# Open http://localhost:3000/api/docs
```

### Code Quality
```bash
pnpm lint          # Fix ESLint issues
pnpm format        # Format with Prettier
pnpm test          # Run tests
pnpm test:cov      # Coverage report
pnpm build         # Production build
```

### Database Operations
```bash
pnpm db:generate   # Create migration
pnpm db:migrate    # Run migrations
pnpm db:studio     # Open Drizzle Studio
```

---

## File Organization

```
docs/
├── README.md                    # This file (navigation hub)
├── project-overview-pdr.md      # Requirements, roadmap, decisions
├── system-architecture.md       # Architecture, data flow, security
├── code-standards.md            # Development conventions & patterns
├── codebase-summary.md          # Directory structure & file reference
└── tech-stack.md                # Technology choices & versions

plans/
└── reports/                     # Subagent reports (reference only)
    ├── docs-manager-260320-1830-phase1-documentation-update.md
    ├── code-reviewer-260320-1825-phase1-scaffolding.md
    ├── researcher-260320-1718-database-schema-design.md
    └── researcher-260320-1718-laravel-backend-architecture.md

src/
├── main.ts                      # Application bootstrap
├── app.module.ts                # Root module
├── config/                      # Configuration factories
├── database/                    # Drizzle ORM setup
└── common/                      # Shared utilities
    ├── decorators/              # @Public, @Roles, @CurrentUser
    ├── guards/                  # RolesGuard
    ├── filters/                 # HttpExceptionFilter
    ├── interceptors/            # TransformInterceptor
    ├── dto/                     # PaginationDto, ApiResponseDto
    └── utils/                   # slugify()
```

---

## Key Implementation Details

### Response Format
All API responses automatically wrapped:
```json
{
  "success": true,
  "data": { ... },
  "message": "OK",
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

### Error Handling
Exceptions return standardized format:
```json
{
  "success": false,
  "data": null,
  "message": "Error description",
  "statusCode": 400
}
```

### Decorators
- `@Public()` — Skip guards (public endpoints)
- `@Roles('admin')` — Require specific role
- `@CurrentUser()` — Extract user from JWT token
- `@CurrentUser('id')` — Extract specific field

### Rate Limiting
- Global limit: 60 requests/minute
- Enforced by ThrottlerGuard
- Disable with `@Public()` decorator

---

## Common Tasks

### Add New Module
1. Create `src/modules/{feature}/` directory
2. Create `{feature}.module.ts`, `.controller.ts`, `.service.ts`
3. Follow patterns in [Code Standards](./code-standards.md)
4. Add integration test
5. Update README & architecture docs

### Add Database Schema
1. Create table definition in `src/database/schema/`
2. Export from `src/database/schema/index.ts`
3. Run `pnpm db:generate`
4. Run `pnpm db:migrate`
5. Document in [Codebase Summary](./codebase-summary.md)

### Write Tests
1. Create `{feature}.spec.ts` alongside code
2. Follow [Vitest patterns](./code-standards.md#test-file-structure)
3. Target 80%+ coverage
4. Run `pnpm test:cov`

### Create API Endpoint
1. Add route to controller with `@Get()`, `@Post()`, etc.
2. Add DTO with validation decorators
3. Add service method with Drizzle query
4. Add @ApiOperation, @ApiResponse Swagger decorators
5. Write unit tests
6. Document in architecture if architectural change

---

## Unresolved Questions (For Phase 2 Planning)

1. **User Role Hierarchy** — How many roles? (admin, moderator, user, guest)
2. **Content Licensing** — Manga source? (original or third-party)
3. **Monetization** — Free-to-read or subscription model?
4. **Notifications** — WebSocket real-time or polling?
5. **Internationalization** — Multi-language support needed?

**Action:** Discuss with stakeholders before Phase 2 starts.

---

## Getting Help

| Question | Reference |
|----------|-----------|
| How do I organize files? | [Code Standards](./code-standards.md#file-organization) |
| What does this decorator do? | [System Architecture](./system-architecture.md#decorators--metadata-phase-1) |
| How does error handling work? | [System Architecture](./system-architecture.md#error-handling-flow) |
| What's the project roadmap? | [Project Overview PDR](./project-overview-pdr.md#roadmap) |
| How do I write tests? | [Code Standards](./code-standards.md#testing-standards) |
| What are the security measures? | [System Architecture](./system-architecture.md#security-considerations-phase-1) |
| How does the database work? | [Codebase Summary](./codebase-summary.md#database-srcdatabase) |
| What's the tech stack? | [Tech Stack](./tech-stack.md) |

---

## Documentation Standards

**When adding documentation:**
- Keep files under 800 lines each
- Use clear headings & tables for organization
- Include practical code examples
- Cross-reference related docs
- Update this README if adding new docs
- Link to actual code files (verify they exist)

**Documentation is living:**
- Update after feature implementation
- Keep examples current with codebase
- Refresh roadmap quarterly
- Review for accuracy before each release

---

## Related Links

- **GitHub Issues/PRs** — Track feature work
- **Swagger Docs** — `/api/docs` (dev environment only)
- **Drizzle Studio** — `pnpm db:studio` (visual database editor)
- **Test Reports** — Generated by `pnpm test:cov`
- **Build Artifacts** — `/dist` directory

---

**Last Updated:** 2026-03-20 (Phase 1 Complete)
**Next Review:** Post-Phase 2 completion
**Maintainer:** Engineering Team
