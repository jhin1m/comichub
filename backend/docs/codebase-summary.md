# ComicHub Codebase Summary

**Last Updated:** Phase 1 Complete (2026-03-20)
**Status:** Project Setup & Scaffolding Complete

## Overview

ComicHub Backend is a NestJS-based REST API for a manga/comic platform. Phase 1 establishes the foundation with configuration, middleware, database setup, and common utilities.

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
├── database/               # Drizzle ORM setup
│   ├── drizzle.provider.ts # Postgres & Drizzle DI
│   ├── drizzle.module.ts   # Global DrizzleModule
│   ├── schema/
│   │   └── index.ts        # Schema barrel (Phase 2)
│   └── seed/
│       └── seed.ts         # Seed runner stub (Phase 2)
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
- Injected as `DRIZZLE` token
- Seed stub ready for Phase 2 table creation

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

## Phase 1 Completion Status

✅ NestJS bootstrap with middleware
✅ Configuration management system
✅ Drizzle ORM integration
✅ Common decorators, guards, filters, interceptors
✅ Standard DTOs and response formats
✅ Swagger documentation scaffold
✅ Test infrastructure (Vitest)

## Next Steps (Phase 2+)

- User & Auth module
- Manga/Comic entities & schema
- API endpoints for CRUD operations
- Authentication & authorization
- Integration tests
