# ComicHub Codebase Summary

**Last Updated:** Phase 2 Complete (2026-03-20)
**Status:** Database Schema & Migrations Complete

## Overview

ComicHub Backend is a NestJS-based REST API for a manga/comic platform. Phase 1 established foundation; Phase 2 completes database schema with 29 tables, relations, and seed data.

## Directory Structure

```
src/
├── main.ts                 # NestJS bootstrap with Swagger, filters, interceptors
├── app.module.ts           # Root module with global imports
├── config/                 # Configuration management
│   ├── app.config.ts       # App (port, env)
│   ├── database.config.ts  # PostgreSQL connection
│   ├── jwt.config.ts       # JWT secrets & expiry
│   ├── redis.config.ts     # Redis connection
│   ├── s3.config.ts        # AWS S3 credentials
│   └── config.module.ts    # ConfigModule exports
├── database/                # Drizzle ORM setup
│   ├── drizzle.provider.ts  # Postgres & Drizzle DI — exports DrizzleDB<schema> type
│   ├── drizzle.module.ts    # Global DrizzleModule
│   ├── schema/
│   │   ├── user.schema.ts           # 2 tables: users, user_profiles
│   │   ├── manga.schema.ts          # 11 tables: manga + lookup + pivots + chapters
│   │   ├── community.schema.ts      # 7 tables: comments, ratings, follows, reports, stickers
│   │   ├── gamification.schema.ts   # 4 tables: achievements, pets, reading_streaks
│   │   ├── notification.schema.ts   # 2 tables: notifications, preferences
│   │   ├── site.schema.ts           # 3 tables: site_settings, advertisements, sticker_sets
│   │   ├── relations.ts             # Drizzle relations for type-safe eager loading
│   │   └── index.ts                 # Barrel export — all 29 tables + relations
│   ├── migrations/
│   │   ├── 0000_nasty_switch.sql    # Initial schema
│   │   └── 0001_absent_microchip.sql # Refinements
│   └── seed/
│       └── seed.ts          # Genre (22), site_settings (5), sticker_sets (1)
└── common/                 # Shared utilities & middleware
    ├── decorators/         # @CurrentUser, @Public, @Roles
    ├── guards/             # RolesGuard
    ├── filters/            # HttpExceptionFilter
    ├── interceptors/       # TransformInterceptor (wraps responses)
    ├── dto/                # PaginationDto, ApiResponseDto
    └── utils/              # slugify()

Config Files:
├── .env.example            # Template for env vars
├── drizzle.config.ts       # Drizzle Kit migrations config
├── vitest.config.ts        # Test runner config
├── nest-cli.json           # NestJS CLI config
├── tsconfig.json           # TypeScript config
├── eslint.config.mjs       # ESLint flat config
└── .prettierrc             # Prettier formatting
```

## Key Files & Purposes

### Bootstrap (src/main.ts)
- Swagger docs at `/api/docs` (dev/staging only)
- Global ValidationPipe (whitelist, forbid unknown)
- Global HttpExceptionFilter (consistent error responses)
- Global TransformInterceptor (wraps success responses)
- CORS enabled in dev (disabled in prod)
- API prefix: `/api/v1`
- Port from env or default 3000

### Configuration (src/config/)
- Centralized env-based config via @nestjs/config
- Registered in ConfigModule and injected globally
- Keys: `app`, `database`, `jwt`, `redis`, `s3`
- Production checks for required secrets (JWT in prod)

### Database (src/database/)
- Drizzle ORM with postgres-js client
- Global DrizzleModule handles connection lifecycle
- Injected as `DRIZZLE` token with **full schema typing** (DrizzleDB<typeof schema>)
- 29 tables organized across 6 domain-specific schema files
- All tables support Drizzle relations for eager loading
- Auto-timestamps: createdAt (default), updatedAt (auto-updated)
- Enums: user_role, manga_status, manga_type, report types, pet_rarity
- Seed runner populates: 22 genres, 5 site_settings, 1 sticker_set

### Common Utilities
- **Decorators:** `@CurrentUser()` extracts user from request
- **Decorators:** `@Public()` marks routes as public (skips auth)
- **Decorators:** `@Roles('admin')` requires specific roles
- **Guard:** RolesGuard checks user.roles against required roles
- **Filter:** HttpExceptionFilter catches all exceptions, returns `{success, data, message, statusCode}`
- **Interceptor:** TransformInterceptor wraps response data in `{success: true, data, message}`
- **DTO:** PaginationDto (page, limit with defaults/validation)
- **DTO:** ApiResponseDto (Swagger response shape)
- **Util:** slugify() converts text → kebab-case slug

## Response Format

All responses wrapped by TransformInterceptor:
```json
{
  "success": true,
  "data": {},
  "message": "OK",
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

## Error Handling

HttpExceptionFilter catches all exceptions:
```json
{
  "success": false,
  "data": null,
  "message": "Error description",
  "statusCode": 400
}
```

## Testing

- **Framework:** Vitest
- **Coverage:** Configured for 80%+ target
- **Excluded:** *.spec.ts, *.dto.ts, main.ts
- Tests in `/src/**/*.spec.ts`

## Tech Stack (Phase 1)

- **Runtime:** Node.js 20+, TypeScript 5.x, pnpm
- **Framework:** NestJS 11
- **Database:** PostgreSQL 16 + Drizzle ORM 0.45
- **Auth:** Passport + JWT (not yet implemented)
- **Cache:** Redis (ioredis)
- **Storage:** AWS S3
- **Validation:** class-validator, class-transformer
- **Logging:** nestjs-pino
- **Quality:** ESLint, Prettier, Vitest

## Phase 2 Completion Status

✅ 29-table database schema (6 domains)
✅ Type-safe DrizzleDB export with full schema
✅ Drizzle relations for eager loading across all domains
✅ Enums, indexes, unique constraints, foreign keys
✅ Auto-timestamps with $onUpdateFn on all updateable tables
✅ Seed data: 22 genres, 5 site_settings, 1 sticker_set
✅ Migrations: 0000 (initial), 0001 (refinements)
✅ No circular FK constraints — app-managed references documented

## Phase 1 Completion Status (Carried Forward)

✅ NestJS bootstrap with middleware
✅ Configuration management system
✅ Drizzle ORM integration
✅ Common decorators, guards, filters, interceptors
✅ Standard DTOs and response formats
✅ Swagger documentation scaffold
✅ Test infrastructure (Vitest)

## Database Schema Quick Reference

**User Domain:** 2 tables (users, user_profiles)
**Manga Domain:** 11 tables (manga + 4 lookup + 4 pivots + chapters + chapter_images)
**Community Domain:** 7 tables (comments, ratings, follows, reading_history, reports, stickers)
**Gamification Domain:** 4 tables (achievements, pets, reading_streaks + user relations)
**Notification Domain:** 2 tables (notifications, preferences)
**Site Domain:** 3 tables (site_settings, advertisements, sticker_sets)

All tables are typed via `DrizzleDB<typeof schema>`, enabling type-safe queries and mutations.

## Next Steps (Phase 3+)

- Auth module (JWT + Passport)
- User CRUD + profile management
- Manga CRUD + genre/artist management
- Chapter & image management
- Comment system (polymorphic + nested replies)
- Rating & review system
- Follow tracking
- Notification system
- Gamification (achievements, pets, streaks)
- Integration tests for all domain modules
