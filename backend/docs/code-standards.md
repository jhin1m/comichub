# ComicHub Code Standards & Guidelines

**Phase:** 1 — Established Foundation
**Last Updated:** 2026-03-20

## File Organization

### Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Modules | kebab-case | `user.module.ts` |
| Controllers | kebab-case | `users.controller.ts` |
| Services | kebab-case | `users.service.ts` |
| Decorators | kebab-case | `current-user.decorator.ts` |
| Guards | kebab-case | `roles.guard.ts` |
| Filters | kebab-case | `http-exception.filter.ts` |
| Interceptors | kebab-case | `transform.interceptor.ts` |
| Utilities | kebab-case | `slug.util.ts` |
| DTOs | kebab-case | `pagination.dto.ts` |
| Tests | `.spec.ts` suffix | `users.service.spec.ts` |

### Directory Structure

```
src/
├── modules/              ← Feature modules (Phase 2+)
│   └── {feature}/
│       ├── {feature}.module.ts
│       ├── {feature}.controller.ts
│       ├── {feature}.service.ts
│       ├── entities/     ← Database entities
│       ├── dto/          ← Data transfer objects
│       └── {feature}.service.spec.ts
├── config/               ← Configuration
├── database/             ← Database (Drizzle)
├── common/               ← Shared
│   ├── decorators/
│   ├── guards/
│   ├── filters/
│   ├── interceptors/
│   ├── dto/
│   └── utils/
├── app.module.ts
└── main.ts
```

## TypeScript Standards

### Strict Mode
✅ All files use `"strict": true` in tsconfig.json
- No implicit any
- Null/undefined checking enabled
- Function return types required

### Type Annotations
```typescript
// ✅ GOOD
function getName(id: string): string {
  return 'name';
}

export interface User {
  id: string;
  name: string;
}

// ❌ AVOID
function getName(id) {
  return 'name';
}

const user: any = {};
```

### Import/Export Style
```typescript
// ✅ Prefer ES6 imports
import { Injectable } from '@nestjs/common';
import { User } from './user.entity';

// ✅ Use named exports for classes
export class UsersService {}

// ✅ Use default export only for modules
export default appConfig;
```

### Module Imports
Use path aliases defined in tsconfig.json:
```typescript
// ✅ GOOD
import { UsersService } from '@/modules/users/users.service';

// ❌ AVOID
import { UsersService } from '../../../../modules/users/users.service';
```

## NestJS Conventions

### Module Structure
```typescript
// ✅ GOOD: Clear, organized
@Module({
  imports: [ConfigModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

### Service Injection
```typescript
// ✅ GOOD: Constructor injection
@Injectable()
export class UsersService {
  constructor(
    private readonly configService: ConfigService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}
}

// ❌ AVOID: Property injection
@Injectable()
export class UsersService {
  @Inject()
  private configService: ConfigService;
}
```

### Controller Routes
```typescript
// ✅ GOOD: Explicit decorators
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async findById(@Param('id') id: string): Promise<User> {
    return this.usersService.findById(id);
  }

  @Post()
  @Roles('admin')
  async create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.create(dto);
  }
}
```

### Dependency Injection
Always use constructor injection:
```typescript
// ✅ GOOD
constructor(private readonly service: MyService) {}

// ❌ AVOID
@Inject(MyService) myService: MyService;
```

## DTOs & Validation

### DTO Structure
```typescript
// ✅ GOOD: Clear validation decorators
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;
}
```

### API Response Wrapper
All responses use standard format (via TransformInterceptor):
```typescript
// Response automatically wrapped as:
{
  "success": true,
  "data": { id: "123", name: "John" },
  "message": "OK",
  "meta": { page: 1, limit: 20, total: 100 }
}
```

## Error Handling

### HTTP Exceptions
```typescript
// ✅ GOOD: Specific HTTP exceptions
import { NotFoundException, BadRequestException } from '@nestjs/common';

throw new NotFoundException('User not found');
throw new BadRequestException('Invalid email format');

// ❌ AVOID: Generic errors
throw new Error('Something went wrong');
```

### Error Response Format
```typescript
// HttpExceptionFilter catches all exceptions and returns:
{
  "success": false,
  "data": null,
  "message": "Error description",
  "statusCode": 400
}
```

## Decorators & Guards

### Authentication/Authorization
```typescript
// ✅ GOOD: Explicit decorators
@Controller('admin')
@Roles('admin')
export class AdminController {
  @Get()
  @Public() // Override global guard
  public() {}

  @Post()
  @Roles('admin', 'moderator')
  create() {}
}

// Inject current user:
async create(
  @CurrentUser() user: User,
  @CurrentUser('id') userId: string,
  @Body() dto: CreateDto,
) {}
```

## Testing Standards

### Test File Structure
```typescript
// ✅ GOOD: Clear test organization
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MyService } from './my.service';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      const result = await service.findById('123');
      expect(result).toBeDefined();
      expect(result.id).toBe('123');
    });

    it('should throw NotFoundException when user not found', async () => {
      await expect(service.findById('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
```

### Test Coverage
- **Target:** 80%+ code coverage
- **Excluded:** *.spec.ts, *.dto.ts, main.ts
- **Run Tests:** `pnpm test` or `pnpm test:watch`
- **Coverage Report:** `pnpm test:cov`

## Code Quality Rules

### ESLint Rules (Phase 1)
- ESLint flat config in `eslint.config.mjs`
- Prettier integration via `eslint-plugin-prettier`
- TypeScript checking via `typescript-eslint`

**Key Rules:**
```
✅ @typescript-eslint/no-explicit-any: off (flexibility)
✅ @typescript-eslint/no-floating-promises: warn
✅ @typescript-eslint/no-unsafe-argument: warn
✅ prettier/prettier: error (auto-format on commit)
```

### Run Linting
```bash
pnpm lint              # Fix issues automatically
pnpm format            # Format code with Prettier
```

### Prettier Configuration
```json
{
  "singleQuote": true,
  "trailingComma": "all"
}
```

## Documentation Standards

### JSDoc Comments
```typescript
// ✅ GOOD: Clear purpose & params
/**
 * Retrieve user by ID with optional role filtering
 * @param id User ID to fetch
 * @param filterRole Optional role to verify
 * @returns User record or null
 * @throws NotFoundException when user not found
 */
async findById(id: string, filterRole?: string): Promise<User | null> {
  // implementation
}
```

### Inline Comments
```typescript
// ✅ GOOD: Explain why, not what
const limit = Math.min(query.limit, 100); // Prevent abuse of pagination

// ❌ AVOID: Redundant comments
const limit = Math.min(query.limit, 100); // Set limit to min of query.limit and 100
```

## Database Standards (Drizzle)

### Query Style
```typescript
// ✅ GOOD: Type-safe Drizzle ORM
const users = await this.db
  .select()
  .from(usersTable)
  .where(eq(usersTable.email, email))
  .limit(1);

// Prepared statements for safety
const findByEmail = this.db
  .select()
  .from(usersTable)
  .where(eq(usersTable.email, sql.placeholder('email')))
  .prepare('find_by_email');
```

### Schema Definition (Phase 2)
```typescript
// ✅ GOOD: Clear schema with constraints
import { pgTable, text, serial, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').unique().notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

## Commit Message Standards

Use conventional commit format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

**Examples:**
```
feat(auth): implement JWT authentication
fix(users): handle null email in validation
docs: update API documentation
test(pagination): add offset calculation tests
chore: update dependencies
```

## Security Best Practices

✅ **Input Validation** — Use class-validator decorators
✅ **Rate Limiting** — ThrottlerGuard (60 req/min)
✅ **Error Messages** — Don't expose stack traces in production
✅ **Environment Variables** — Use .env, never commit .env
✅ **SQL Injection** — Use Drizzle (parameterized queries)
✅ **CORS** — Disable in production

⚠️ **TODO (Phase 2+)**
- Helmet for security headers
- Bcrypt for password hashing
- JWT token rotation
- Input sanitization
- Request logging
- Audit trails

## Performance Guidelines

✅ **Pagination** — Always use limit/offset for large datasets
✅ **Indexes** — Define on frequently queried columns
✅ **Lazy Loading** — Load relations only when needed
✅ **Caching** — Use Redis for frequently accessed data
✅ **Async/Await** — Never block event loop
✅ **Connection Pooling** — postgres-js manages internally

## Phase 1 Checklist

✅ TypeScript strict mode
✅ NestJS module structure
✅ Constructor injection
✅ Decorator-based validation
✅ Standard response/error formats
✅ Vitest test setup
✅ ESLint + Prettier integration
✅ Database (Drizzle) integration
✅ Security: Rate limiting, CORS, validation

## Phase 2 Tasks

- [ ] Add Swagger documentation decorators (@ApiOperation, @ApiResponse)
- [ ] Implement database schema & migrations
- [ ] Add user authentication (JWT + Passport)
- [ ] Expand service layer with business logic
- [ ] Write comprehensive test suite (80%+ coverage)
- [ ] Add Helmet for security headers
- [ ] Implement caching strategy (Redis)
- [ ] Add structured logging (nestjs-pino)
