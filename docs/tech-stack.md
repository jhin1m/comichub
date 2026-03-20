# ComicHub — Tech Stack

## Runtime & Language
- **Runtime:** Node.js 20+ (LTS)
- **Language:** TypeScript 5.x (strict mode)
- **Package Manager:** pnpm

## Framework
- **Backend:** NestJS 11
- **Architecture:** Modular (modules/controllers/services/entities)
- **API Style:** REST v1 (`/api/v1/...`)

## Database
- **Engine:** PostgreSQL 16
- **ORM:** Drizzle ORM (type-safe, SQL-like)
- **Migrations:** Drizzle Kit

## Authentication & Authorization
- **Auth:** Passport + JWT (access + refresh tokens)
- **OAuth:** Google OAuth 2.0 via Passport strategy
- **RBAC:** CASL or custom guards with decorators

## Key Packages
| Package | Purpose |
|---------|---------|
| `@nestjs/swagger` | Auto-generated OpenAPI docs |
| `drizzle-orm` + `drizzle-kit` | ORM + migrations |
| `@nestjs/passport` + `passport-jwt` | JWT authentication |
| `passport-google-oauth20` | Google OAuth |
| `class-validator` + `class-transformer` | DTO validation |
| `@nestjs/cache-manager` + `ioredis` | Redis caching |
| `@nestjs/throttler` | Rate limiting |
| `@aws-sdk/client-s3` | S3 image storage |
| `@nestjs/bull` | Queue/job processing |
| `sharp` | Image optimization |
| `nestjs-pino` | Structured logging |

## Infrastructure
- **Cache:** Redis
- **Storage:** AWS S3
- **Queue:** Bull (Redis-backed)
- **Logging:** Pino

## Testing
- **Framework:** Vitest
- **E2E:** Supertest
- **Coverage target:** 80%+

## Code Quality
- **Linter:** ESLint (flat config)
- **Formatter:** Prettier
- **Pre-commit:** Husky + lint-staged
