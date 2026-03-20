# ComicHub System Architecture

**Phase:** 2 — Database Schema & Migrations
**Status:** Database Layer Complete

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

## Database Schema (Phase 2)

### Table Overview (29 tables across 6 domains)

#### User Domain (2 tables)
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `users` | Auth & gamification | uuid, email, password, xp, level, googleId, role |
| `user_profiles` | Extended profiles | userId, bio, website, twitter, discord |

#### Manga Domain (11 tables)
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `manga` | Core content | title, slug, status, type, views, followers, averageRating |
| `genres` | Lookup — 22 seeded | name, slug |
| `artists` | Creator lookup | name, slug |
| `authors` | Creator lookup | name, slug |
| `groups` | Translation groups | name, slug |
| `chapters` | Content structure | mangaId, chapterNum, volume, pages, views |
| `chapter_images` | Chapter media | chapterId, imageUrl, order |
| `manga_genres` | M-to-M pivot | mangaId, genreId (unique constraint) |
| `manga_artists` | M-to-M pivot | mangaId, artistId (unique constraint) |
| `manga_authors` | M-to-M pivot | mangaId, authorId (unique constraint) |
| `manga_groups` | M-to-M pivot | mangaId, groupId (unique constraint) |

#### Community Domain (7 tables)
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `comments` | Polymorphic nested | commentableType, commentableId, parentId, content |
| `comment_likes` | Like tracking | userId, commentId (unique constraint) |
| `ratings` | User ratings | userId, mangaId, rating, review (unique constraint) |
| `follows` | User follows manga | userId, mangaId (unique constraint) |
| `reading_history` | Track progress | userId, chapterId, readAt (unique constraint) |
| `chapter_reports` | Issue reporting | reportType, reportStatus, content, resolution |
| `stickers` | Chat stickers | name, imageUrl |

#### Gamification Domain (4 tables)
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `achievements` | Unlockable rewards | name, description, criteria (JSONB), xpReward |
| `user_achievements` | User progress | userId, achievementId (unique constraint) |
| `pets` | Collectible companions | name, price, rarity (common/rare/epic/legendary) |
| `user_pets` | Pet ownership | userId, petId, level, happiness |

#### Notification Domain (2 tables)
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `notifications` | User alerts | userId, notificationType, content, isRead |
| `notification_preferences` | Settings per user | userId, channel, isEnabled |

#### Site Domain (3 tables)
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `site_settings` | KV config store | key, value (5 seeded) |
| `advertisements` | Banner ads | imageUrl, link, position, order |
| `sticker_sets` | Sticker groups | name, isActive (1 default set seeded) |

### Relational Queries (Drizzle Relations)

All 29 tables have **Drizzle relations** defined in `src/database/schema/relations.ts` for type-safe eager loading:

- `users → userProfiles` (1-to-1)
- `users → manga` (1-to-many: uploaded manga)
- `users → comments, ratings, follows, achievements` (1-to-many)
- `manga → chapters` (1-to-many)
- `manga → genres/artists/authors/groups` (many-to-many via pivots)
- `comments → commentLikes` (1-to-many)
- `chapters → chapterImages` (1-to-many)
- Full relational chain enables `.with()` queries in Drizzle

### Database Features

**Enums** (Type Safety)
- `user_role` — admin, user
- `manga_status` — ongoing, completed, hiatus, dropped
- `manga_type` — manga, manhwa, manhua, doujinshi
- `report_type` — 6 issue categories
- `report_status` — pending, resolved, rejected
- `pet_rarity` — common, rare, epic, legendary

**Constraints & Indexes**
- **Unique constraints** on: email, uuid, slug, google_id, genre/artist/author/group names
- **Foreign keys** with `onDelete` cascade/set null for data integrity
- **Indexes** on high-traffic queries: manga status/type, manga views, comment threads, reading history
- **Circular reference handling** — Manga.lastChapterId has no FK (prevents cycle with chapters), managed by application layer

**Auto-Timestamps**
- All tables have `createdAt` (default: NOW)
- Updateable tables have `updatedAt.$onUpdateFn(() => new Date())` for automatic updates on writes

### DrizzleDB Type Export

`drizzle.provider.ts` exports:
```typescript
export type DrizzleDB = PostgresJsDatabase<typeof schema>;
```
Enables **fully typed database operations** across services.

### Migrations

- `0000_nasty_switch.sql` — Initial schema creation (Phase 1)
- `0001_absent_microchip.sql` — Schema refinements (Phase 2)
- Managed by Drizzle Kit: `pnpm run db:generate`, `pnpm run db:migrate`

### Seed Data

**Genre Lookup** (22 genres seeded)
Action, Adventure, Comedy, Drama, Fantasy, Horror, Mystery, Romance, Sci-Fi, Slice of Life, Sports, Supernatural, Thriller, Historical, Isekai, Martial Arts, Mecha, School, Shounen, Shoujo, Seinen, Josei

**Site Settings** (5 defaults)
- site_name = "ComicHub"
- site_description = "Read manga, manhwa, manhua online"
- site_logo = ""
- posts_per_page = "20"
- maintenance_mode = "false"

**Sticker Sets** (1 default)
- Default set created with `isActive = true`

## Module Structure (Phase 1-2)

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

## Phase 3+ Preview

CRUD modules will implement services using fully-typed DrizzleDB:
```
src/
├── modules/
│   ├── auth/           ← JWT + Passport (Phase 3)
│   ├── users/          ← User CRUD + profiles
│   ├── mangas/         ← Manga CRUD + genres/artists
│   ├── chapters/       ← Chapter management + images
│   ├── comments/       ← Polymorphic comments + nested replies
│   ├── ratings/        ← Manga ratings & reviews
│   ├── follows/        ← User follows tracking
│   ├── notifications/  ← Alert system
│   ├── gamification/   ← Achievements, pets, streaks
│   └── uploads/        ← S3 image handling
├── common/             ← Shared (Phase 1)
└── database/           ← Schema complete (Phase 2)
```
