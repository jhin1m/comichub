# ComicHub

A modern manga/comic reading platform built with **NestJS** and **Next.js 16**.

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | NestJS 11, Drizzle ORM, PostgreSQL, Redis |
| **Frontend** | Next.js 16, React 19, Tailwind CSS v4, Radix UI |
| **Auth** | JWT (access/refresh tokens), Google OAuth |
| **Storage** | AWS S3 |
| **Testing** | Vitest |

## Features

- Browse, search, and read manga with a responsive reader
- User accounts with Google OAuth and email/password login
- Follow manga, rate, comment, and track reading history
- Admin panel for content and user management
- Full-text search with advanced filters (genre, status, sort)
- View tracking and popularity rankings
- In-app notifications
- SEO-friendly with sitemap generation

## Getting Started

### Prerequisites

- **Node.js** >= 20
- **npm** >= 10
- **PostgreSQL** >= 15
- **Redis** (optional — caching and view counters)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/comichub.git
cd comichub
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials and secrets
npm install
npm run db:migrate
npm run db:seed       # optional: seed sample data
npm run start:dev     # starts on http://localhost:8080
```

### 3. Frontend setup

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
npm install
npm run dev           # starts on http://localhost:3000
```

### Environment Variables

<details>
<summary>Backend (.env)</summary>

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | Secret for access tokens |
| `JWT_REFRESH_SECRET` | Yes | Secret for refresh tokens |
| `REDIS_URL` | No | Redis connection string |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `AWS_S3_BUCKET` | No | S3 bucket for image storage |

</details>

<details>
<summary>Frontend (.env.local)</summary>

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL (default: `http://localhost:8080/api/v1`) |

</details>

## Project Structure

```
comichub/
├── backend/              # NestJS API server
│   ├── src/
│   │   ├── database/     # Drizzle schema, migrations, seeds
│   │   ├── modules/      # Feature modules (auth, manga, user, community, ...)
│   │   ├── common/       # Guards, interceptors, decorators, pipes
│   │   └── main.ts
│   └── tests/            # Integration & e2e tests
├── frontend/             # Next.js 16 app
│   ├── app/              # App Router pages & layouts
│   ├── components/       # Shared UI components
│   ├── lib/              # API client, utilities
│   └── contexts/         # React context providers
└── docs/                 # Design guidelines & documentation
```

## Available Scripts

### Backend

```bash
npm run start:dev     # Development server with hot reload
npm run build         # Production build
npm run lint          # Run ESLint
npm run test          # Run unit tests
npm run test:cov      # Test coverage report
npm run test:e2e      # End-to-end tests
npm run db:generate   # Generate Drizzle migrations
npm run db:migrate    # Apply migrations
npm run db:studio     # Open Drizzle Studio (DB browser)
```

### Frontend

```bash
npm run dev           # Development server
npm run build         # Production build (includes type-check)
```

## API Overview

All endpoints are prefixed with `/api/v1`. The API uses a standard response envelope:

```json
{
  "success": true,
  "data": { ... },
  "message": "OK"
}
```

Authentication is required by default (JWT Bearer token). Public endpoints are explicitly marked.

## Contributing

Contributions are welcome and greatly appreciated! Whether it's a bug fix, new feature, documentation improvement, or just a typo fix — every contribution counts.

### How to Contribute

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feat/your-feature`
3. **Commit** your changes using [conventional commits](https://www.conventionalcommits.org/):
   ```
   feat: add manga bookmark feature
   fix: resolve chapter navigation bug
   docs: update API documentation
   ```
4. **Push** to your branch: `git push origin feat/your-feature`
5. **Open a Pull Request** against `main`

### Development Guidelines

- Follow the existing code patterns and project structure
- Write tests for new features
- Keep PRs focused — one feature or fix per PR
- Run `npm run lint` and `npm run test` before submitting
- Use TypeScript strict mode — no `any` types unless absolutely necessary

### First-Time Contributors

New here? Look for issues labeled **`good first issue`** or **`help wanted`**. Feel free to ask questions in the issue comments — we're happy to help you get started!

### Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS, Node version, browser)

### Suggesting Features

Open an issue with:
- A clear description of the feature
- Why it would be useful
- Any implementation ideas you have

## License

This project is currently unlicensed. See [LICENSE](LICENSE) for details.

---

Built with care by the ComicHub community.
