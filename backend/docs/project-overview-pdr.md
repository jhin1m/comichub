# ComicHub Backend API — Project Overview & PDR

**Project:** ComicHub Backend API
**Phase:** 2 Complete — Database Schema & Migrations
**Status:** Data Layer Ready for CRUD Modules
**Last Updated:** 2026-03-20

---

## Executive Summary

ComicHub is a modern manga/comic platform backend API built with NestJS, PostgreSQL, and Drizzle ORM. Phase 1 established foundation; Phase 2 completes comprehensive database schema with 29 tables across 6 domains, type-safe relational queries, and seed data.

**Phase 2 Achievement:** 29-table database schema (users, manga, community, gamification, notifications, site) with full Drizzle relations, auto-timestamps, enums, indexes, and seeded data (22 genres, 5 site settings).

---

## Roadmap

| Phase | Title | Status |
|-------|-------|--------|
| 1 | Project Setup & Scaffolding | ✅ Complete |
| 2 | Database Schema & Migrations | ✅ Complete |
| 3 | Auth Module & User CRUD | 🔄 Next |
| 4 | Manga CRUD & Management | 📋 Planned |
| 5 | Comments & Community Features | 📋 Planned |
| 6 | Gamification & Notifications | 📋 Planned |
| 7 | Integration Tests & Optimization | 📋 Planned |

---

## Product Overview

### Vision
Enable readers to discover, read, and engage with manga and comic content through a modern REST API with robust authentication, user profiles, and content discovery features.

### Core Capabilities (Planned)
1. **User Management** — Registration, profiles, preferences
2. **Content Discovery** — Browse, search, filter manga/comics
3. **Reading Experience** — Chapter reading, bookmarks, progress tracking
4. **Social Features** — Ratings, reviews, recommendations
5. **Media Management** — Image uploads, optimization, caching

### Target Users
- Manga/comic readers
- Content creators/publishers
- API consumers (web/mobile apps)

---

## Phase 2: Database Schema & Migrations (COMPLETE)

### Functional Requirements

#### FR6: Database Schema Design
**Status:** ✅ Complete
- 29 tables across 6 domains for scalability
- Type-safe query building with Drizzle relations
- Proper foreign key constraints and cascading deletes
- Enum types for domain-specific values
- Indexes on high-traffic query paths

**Implementation:**
- `src/database/schema/` — 6 domain-specific files (user, manga, community, gamification, notification, site)
- `src/database/schema/relations.ts` — Type-safe Drizzle relations (1-to-1, 1-to-many, many-to-many)
- **User Domain:** 2 tables (users, user_profiles)
- **Manga Domain:** 11 tables (manga + 4 lookup tables + 4 pivot tables + chapters + chapter_images)
- **Community Domain:** 7 tables (comments, ratings, follows, reading_history, reports, stickers, sticker_likes)
- **Gamification Domain:** 4 tables (achievements, pets, reading_streaks + user relations)
- **Notification Domain:** 2 tables (notifications, preferences)
- **Site Domain:** 3 tables (site_settings, advertisements, sticker_sets)

#### FR7: Auto-Timestamps & Constraints
**Status:** ✅ Complete
- Auto-timestamps on all tables (createdAt, updatedAt with $onUpdateFn)
- Unique constraints on domain keys (email, uuid, slug, names)
- Foreign keys with cascading deletes for data consistency
- No circular FK constraints — app-managed references documented

**Implementation:**
- All tables use `createdAt: timestamp.defaultNow()`
- Updateable tables have `updatedAt.$onUpdateFn(() => new Date())`
- Manga.lastChapterId has no FK (prevents circular constraint with chapters), managed by application

#### FR8: Database Enums
**Status:** ✅ Complete
- Type-safe enums for domain values
- User roles, manga status/type, report types, pet rarity

**Enums:**
- `user_role` — admin, user
- `manga_status` — ongoing, completed, hiatus, dropped
- `manga_type` — manga, manhwa, manhua, doujinshi
- `report_type` — 6 issue categories
- `report_status` — pending, resolved, rejected
- `pet_rarity` — common, rare, epic, legendary

#### FR9: Migrations & Seed Data
**Status:** ✅ Complete
- Drizzle migrations managed via Drizzle Kit
- Seed runner for initial data population

**Implementation:**
- `src/database/migrations/0000_nasty_switch.sql` — Initial schema creation
- `src/database/migrations/0001_absent_microchip.sql` — Refinements
- `src/database/seed/seed.ts` — Populates:
  - 22 genres (action, adventure, comedy, drama, fantasy, horror, etc.)
  - 5 site_settings (site_name, site_description, site_logo, posts_per_page, maintenance_mode)
  - 1 default sticker_set

#### FR10: Type-Safe DrizzleDB Export
**Status:** ✅ Complete
- Global typed database access for all modules
- Full schema typing enables IDE autocomplete

**Implementation:**
- `drizzle.provider.ts` exports `type DrizzleDB = PostgresJsDatabase<typeof schema>`
- Services inject `@Inject(DRIZZLE)` and get full type coverage
- All 29 tables + relations available on DrizzleDB instance

---

## Phase 1: Project Setup & Scaffolding (COMPLETE)

### Functional Requirements

#### FR1: Bootstrap NestJS Application
**Status:** ✅ Complete
- Initialize NestJS 11 project with TypeScript strict mode
- Configure API prefix `/api/v1`
- Set up OpenAPI/Swagger documentation
- Implement graceful shutdown hooks

**Implementation:**
- `src/main.ts` — Bootstrap with middleware pipeline
- Swagger docs enabled at `/api/docs` (dev/staging only)
- ValidationPipe with whitelist mode
- CORS enabled in development, disabled in production

#### FR2: Configuration Management
**Status:** ✅ Complete
- Centralized environment-based configuration
- Support for development, staging, production environments
- Safe secret handling with validation

**Implementation:**
- `src/config/` directory with factories:
  - `app.config.ts` — PORT, NODE_ENV
  - `database.config.ts` — DATABASE_URL validation
  - `jwt.config.ts` — JWT secrets with prod validation
  - `redis.config.ts` — Redis connection
  - `s3.config.ts` — AWS S3 credentials
- `.env.example` template provided

#### FR3: Database Integration
**Status:** ✅ Complete
- Drizzle ORM integration with PostgreSQL
- Type-safe query builder
- Connection pooling via postgres-js
- Migration management ready

**Implementation:**
- `src/database/drizzle.module.ts` — Global module
- `src/database/drizzle.provider.ts` — Dependency injection
- `drizzle.config.ts` — Drizzle Kit configuration
- Seed infrastructure ready for Phase 2

#### FR4: Middleware & Guards
**Status:** ✅ Complete
- Global exception handling
- Standard response formatting
- Input validation
- Rate limiting
- Role-based access control (RBAC) framework

**Implementation:**
- `src/common/filters/http-exception.filter.ts` — Exception handling
- `src/common/interceptors/transform.interceptor.ts` — Response wrapping
- `src/common/guards/roles.guard.ts` — RBAC enforcement
- `src/common/decorators/` — @Public, @Roles, @CurrentUser

#### FR5: Testing Infrastructure
**Status:** ✅ Complete
- Vitest framework setup
- Unit test examples
- Coverage configuration

**Implementation:**
- `vitest.config.ts` — Test runner config
- 4 test files demonstrating patterns
- Coverage target: 80%+

### Non-Functional Requirements

#### NFR1: Performance
**Target:** Sub-200ms API response time for simple queries
**Implementation:** Drizzle ORM, connection pooling, rate limiting

#### NFR2: Security
**Target:** OWASP Top 10 compliance
**Implemented:**
- ✅ Input validation (whitelist mode)
- ✅ Rate limiting (60 req/min global)
- ✅ CORS restrictions (production safe)
- ✅ SQL injection prevention (Drizzle parameterized)
- ⏳ JWT authentication (Phase 2)
- ⏳ Password hashing (Phase 2)
- ⏳ Audit logging (Phase 2)

#### NFR3: Maintainability
**Target:** Code coverage 80%+, clear module structure
**Implemented:**
- Modular architecture ready
- Consistent naming conventions
- Reusable decorators & guards
- Common utilities isolated

#### NFR4: Scalability
**Target:** Support 100k+ concurrent users
**Infrastructure:**
- Stateless API (can be replicated)
- Database connection pooling
- Redis caching ready
- S3 for static content

---

## Acceptance Criteria (Phase 1)

- [x] NestJS application boots successfully
- [x] Configuration loads from environment variables
- [x] PostgreSQL connection establishes via Drizzle
- [x] Swagger documentation available at `/api/docs`
- [x] Global error handling returns standardized response format
- [x] Response interceptor wraps all data consistently
- [x] Rate limiting active on all routes (60 req/min)
- [x] CORS configured based on NODE_ENV
- [x] Validation pipe rejects invalid DTOs
- [x] @Roles guard enforces role restrictions
- [x] @Public decorator bypasses guards
- [x] @CurrentUser decorator provides user context
- [x] Unit tests pass with Vitest
- [x] No TypeScript errors (strict mode)
- [x] ESLint + Prettier configured

---

## Architecture Decisions

### Decision 1: NestJS Framework
**Rationale:** Enterprise-grade, modular, extensive ecosystem, TypeScript-first
**Alternatives:** Express (too low-level), Fastify (less mature ecosystem)
**Impact:** Structure, middleware consistency, testing patterns

### Decision 2: Drizzle ORM
**Rationale:** Type-safe, SQL-like syntax, lightweight, excellent TypeScript support
**Alternatives:** TypeORM (heavier), Sequelize (less type-safe)
**Impact:** Query safety, developer experience, migration strategy

### Decision 3: Global Module Architecture
**Rationale:** DrizzleModule as global enables injection in any service
**Pattern:** Follows NestJS best practices
**Impact:** No need to import database module in feature modules

### Decision 4: Standard Response Format
**Rationale:** Consistent API contract for clients, easier error handling
**Format:** `{success, data, message, meta}`
**Implementation:** TransformInterceptor automatically applied

### Decision 5: Decorator-Based Guards
**Rationale:** Declarative, readable, flexible per-route
**Pattern:** @Public, @Roles decorators with RolesGuard
**Impact:** Clear intent, easy to test, supports multiple strategies

---

## Tech Stack Justification

| Technology | Why Chosen | Version |
|-----------|-----------|---------|
| Node.js | Fast, async, JavaScript ecosystem | 20+ LTS |
| TypeScript | Type safety, IDE support, compile-time errors | 5.x strict |
| NestJS | Enterprise patterns, modularity, DI | 11 |
| PostgreSQL | Mature, ACID-compliant, relational | 16 |
| Drizzle ORM | Type-safe, lightweight, excellent TypeScript | 0.45 |
| postgres-js | Modern, async, optimized | 3.4 |
| Vitest | Fast, ESM-native, Vite integration | 4.1 |
| Redis | Session storage, caching, rate limiting | (not yet) |
| AWS S3 | Scalable image storage | (not yet) |
| Passport JWT | Industry standard auth framework | 4.0 |

---

## Known Constraints & Limitations

### Phase 1 Scope
- ❌ No database schema defined (empty schema barrel)
- ❌ No user authentication implemented
- ❌ No API endpoints yet
- ❌ No production deployment configured
- ❌ Redis not yet integrated
- ❌ S3 not yet integrated

### Technical Constraints
- Single-instance deployment only (no distributed caching)
- Rate limiter in-memory (not distributed)
- No multi-tenancy support
- PostgreSQL only (not multi-database)

### Operational Constraints
- No automated backups configured
- No monitoring/alerting setup
- No CI/CD pipeline yet
- Swagger disabled in production

---

## Success Metrics

### Phase 1 Completion Metrics (ACHIEVED)
- ✅ All dependencies installed without conflicts
- ✅ Application boots without errors
- ✅ Configuration loads from .env
- ✅ Database connection successful
- ✅ Tests pass with Vitest (4/4 test files)
- ✅ Code coverage configured (80%+ target)
- ✅ TypeScript compilation error-free
- ✅ ESLint passes with no errors

### Phase 2+ Metrics (Planned)
- API endpoint response time < 200ms (p95)
- Code coverage > 80%
- Uptime > 99.5%
- Zero critical security vulnerabilities
- Request success rate > 99.9%

---

## Dependencies & Integration Points

### Required External Services
- **PostgreSQL 16** — Data persistence
- **Redis** (Phase 2) — Caching & sessions
- **AWS S3** (Phase 2) — Image storage
- **Google OAuth** (Phase 2) — Social login

### Internal Dependencies
- `@nestjs/*` — Framework and tooling
- `drizzle-orm` + `postgres` — Database
- `passport-jwt` — Authentication (Phase 2)
- `class-validator` + `class-transformer` — DTO validation
- `nestjs-pino` — Logging (Phase 2)

---

## Risk Assessment

### High Priority Risks

**Risk 1: Database Connection Failures**
- **Impact:** API unavailable
- **Probability:** Low (pooling handles transient failures)
- **Mitigation:** Add connection retry logic, health checks (Phase 2)

**Risk 2: Performance Degradation**
- **Impact:** Slow responses, timeouts
- **Probability:** Medium (no indexing yet)
- **Mitigation:** Database indexing, caching strategy (Phase 2)

**Risk 3: Security Vulnerabilities**
- **Impact:** Data breach, unauthorized access
- **Probability:** Medium (no auth yet)
- **Mitigation:** JWT implementation, secret rotation, audit logging (Phase 2)

### Medium Priority Risks

**Risk 4: Scalability Bottlenecks**
- **Impact:** Cannot handle traffic spikes
- **Probability:** Medium (single instance)
- **Mitigation:** Horizontal scaling, load balancing (deployment phase)

**Risk 5: Configuration Management**
- **Impact:** Secrets exposed, wrong env used
- **Probability:** Low (env-based, validation exists)
- **Mitigation:** Vault integration, audit logs (Phase 2)

---

## Roadmap

### Phase 1 (COMPLETE)
- Project setup & scaffolding ✅
- NestJS bootstrap ✅
- Configuration management ✅
- Database integration ✅
- Middleware & guards ✅

### Phase 2 (Q2 2026)
- Database schema design (users, manga, chapters)
- User authentication (JWT + Passport)
- User CRUD endpoints
- Manga/comic CRUD endpoints
- Integration tests

### Phase 3 (Q3 2026)
- Chapter reading endpoints
- Bookmark & progress tracking
- Social features (ratings, reviews)
- Search & filtering
- Recommendation engine

### Phase 4 (Q4 2026)
- Image upload & optimization (S3)
- Caching layer (Redis)
- Admin dashboard
- Analytics & monitoring
- Performance optimization

---

## Development Workflow

### Local Setup
```bash
# 1. Clone repository
git clone <repo>
cd comichub

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env with local database URL

# 4. Start development server
pnpm start:dev
# Server runs on http://localhost:3000
# Swagger docs at http://localhost:3000/api/docs
```

### Commit & Code Quality
```bash
# Run linter
pnpm lint

# Format code
pnpm format

# Run tests
pnpm test
pnpm test:watch
pnpm test:cov

# Build for production
pnpm build
pnpm start:prod
```

### Database Operations
```bash
# Generate migrations from schema changes
pnpm db:generate

# Run pending migrations
pnpm db:migrate

# Open interactive studio
pnpm db:studio
```

---

## Questions & Next Steps

### Unresolved Questions
1. **User Role Hierarchy:** How many roles (admin, moderator, user)? Custom permissions?
2. **Content Licensing:** Manga sources — original content or third-party?
3. **Monetization:** Free-to-read or subscription model?
4. **Notification System:** Real-time updates (WebSocket) or polling?
5. **Internationalization:** Multi-language support needed?

### Immediate Next Steps
1. Define database schema (Phase 2 planning)
2. Design authentication strategy
3. Plan API endpoint contracts
4. Set up CI/CD pipeline
5. Configure production environment

---

## Document References

- [Codebase Summary](./codebase-summary.md) — Directory structure & file purposes
- [System Architecture](./system-architecture.md) — Data flow, middleware, security
- [Code Standards](./code-standards.md) — Naming, testing, quality guidelines
- [Tech Stack](./tech-stack.md) — Dependency list & versions

---

**Document Owner:** Engineering Team
**Last Review:** 2026-03-20
**Next Review:** Post-Phase 2 completion
