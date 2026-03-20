# ComicHub System Architecture

**Phase:** 1 — Project Setup & Scaffolding
**Status:** Foundation Complete

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│             HTTP Requests (Express)                 │
│  (CORS enabled in dev, disabled in prod)            │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Swagger Docs        │ ← /api/docs (dev only)
        │  ValidationPipe      │ ← Validates & transforms DTOs
        └──────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Request Handler     │
        │  @Controller/@Get... │
        └──────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Service Logic       │
        │  @Injectable()       │
        └──────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Drizzle ORM         │
        │  Database queries    │
        └──────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  PostgreSQL 16       │
        │  Persistent data     │
        └──────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ TransformInterceptor │ ← Wraps response in standard format
        │ HttpExceptionFilter  │ ← Catches all errors
        │ ThrottlerGuard       │ ← Rate limiting (60/min)
        └──────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  JSON Response       │
        │  {success, data...}  │
        └──────────────────────┘
```

## Module Structure (Phase 1)

### AppModule (Root)
Imports:
- **AppConfigModule** — Global env config
- **DrizzleModule** — Global database access
- **ThrottlerModule** — Rate limiting (60 req/min)

Global Providers:
- ThrottlerGuard (APP_GUARD) — Applies to all routes

### AppConfigModule
Loads environment variables via @nestjs/config:
- `app` config (NODE_ENV, PORT)
- `database` config (DATABASE_URL)
- `jwt` config (secrets, expiry)
- `redis` config (REDIS_URL)
- `s3` config (AWS credentials)

### DrizzleModule (Global)
Lifecycle:
1. ConfigService provides DATABASE_URL
2. postgresClientProvider creates postgres-js connection
3. drizzleProvider creates Drizzle instance
4. OnModuleDestroy closes postgres connection

Injected as: `@Inject(DRIZZLE)` symbol

## Request Flow

1. **HTTP Request** → Express middleware
2. **CORS** — Enabled in dev, restricted in prod
3. **ValidationPipe** — DTO validation & transformation
4. **Route Handler** → Controller method
5. **Service Logic** → Query database via Drizzle
6. **TransformInterceptor** → Wrap response data
7. **HttpExceptionFilter** → Catch errors
8. **Response** → JSON to client

## Middleware & Guards (Phase 1)

| Component | Purpose | Scope |
|-----------|---------|-------|
| ValidationPipe | DTO validation | Global |
| TransformInterceptor | Response wrapping | Global |
| HttpExceptionFilter | Error handling | Global |
| ThrottlerGuard | Rate limiting (60/min) | Global |
| RolesGuard | RBAC enforcement | Per-route with @Roles |

## Decorators & Metadata (Phase 1)

| Decorator | Usage | Purpose |
|-----------|-------|---------|
| `@Public()` | `@Public() @Get()` | Skip throttler & auth checks |
| `@CurrentUser()` | `currentUser: User` | Extract user from JWT |
| `@CurrentUser('id')` | `userId: string` | Extract specific field |
| `@Roles('admin')` | `@Roles('admin')` | Require specific roles |

## Data Flow: API Request Example

```
GET /api/v1/comics?page=1&limit=20

1. ValidationPipe transforms query to PaginationDto
   → page: 1, limit: 20

2. ComicsController.findAll(pagination)

3. ComicsService.findAll(pagination)
   → db.select().from(comics).limit(20).offset(0)

4. Drizzle executes query on PostgreSQL

5. TransformInterceptor wraps result:
{
  "success": true,
  "data": [...comics],
  "message": "OK",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}

6. Response sent to client
```

## Error Handling Flow

```
GET /api/v1/comics/invalid

1. ValidationPipe validates path param
   → Error: "invalid" not a number

2. HttpExceptionFilter catches validation error

3. Response:
{
  "success": false,
  "data": null,
  "message": "Validation failed: invalid not a number",
  "statusCode": 400
}

4. Response sent with 400 status
```

## Database Connection Management

**Lifecycle:**
1. AppModule loads
2. DrizzleModule initializes
3. postgresClientProvider creates postgres-js connection from DATABASE_URL
4. drizzleProvider wraps connection with Drizzle ORM
5. DrizzleModule.onModuleDestroy() closes connection on shutdown

**Connection Pooling:**
- postgres-js handles connection pooling internally
- No explicit pool config (uses defaults)

## Configuration Hierarchy

```
Environment Variables (.env or OS env)
         ↓
@nestjs/config (ConfigModule)
         ↓
Config Factories (appConfig, databaseConfig, etc.)
         ↓
ConfigService.get('app.port', default)
         ↓
@Injectable services via dependency injection
```

## Security Considerations (Phase 1)

✅ **Input Validation** — ValidationPipe whitelist mode enabled
✅ **Rate Limiting** — ThrottlerGuard (60 req/min global)
✅ **CORS** — Disabled in production
✅ **Public Routes** — @Public() decorator to skip guards
✅ **Role-Based Access** — @Roles() + RolesGuard ready

⚠️ **TODO (Phase 2+)**
- JWT authentication module
- Refresh token strategy
- OAuth2 (Google) integration
- Input sanitization beyond validation
- HTTPS/TLS enforcement
- API key management

## Performance Considerations

- **Validation:** Sync transformation (whitelist mode prevents unknown fields)
- **Rate Limiting:** In-memory throttler (suitable for single instance)
- **Database:** Drizzle generates efficient SQL (type-safe)
- **Caching:** Redis integration ready (not yet used)
- **Logging:** nestjs-pino (structured, async)

## Testing Architecture (Phase 1)

- **Vitest** — Unit tests in `src/**/*.spec.ts`
- **Coverage Exclusions:** *.spec.ts, *.dto.ts, main.ts
- **Fixtures:** Mock in @nestjs/testing available for Phase 2
- **E2E:** Supertest ready for integration tests

## Phase 1 Artifacts

**Files:**
- `src/main.ts` — Bootstrap with middleware setup
- `src/app.module.ts` — Root module
- `src/config/*` — Configuration factories
- `src/database/*` — Drizzle integration
- `src/common/` — Decorators, guards, filters, interceptors, DTOs, utils

**Tests:**
- `src/common/dto/pagination.dto.spec.ts`
- `src/common/filters/http-exception.filter.spec.ts`
- `src/common/interceptors/transform.interceptor.spec.ts`
- `src/common/utils/slug.util.spec.ts`

**Config:**
- `drizzle.config.ts` — Drizzle Kit migrations
- `vitest.config.ts` — Test runner
- `.env.example` — Environment template

## Phase 2 Preview

Module structure will expand:
```
src/
├── modules/
│   ├── auth/          ← JWT + Passport
│   ├── users/         ← User CRUD
│   ├── mangas/        ← Manga CRUD
│   ├── comics/        ← Comic CRUD
│   ├── chapters/      ← Chapter management
│   └── uploads/       ← S3 image handling
├── common/            ← Shared (existing)
└── database/          ← Schema expansion
```
