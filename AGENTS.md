# AGENTS.md

## Architecture
- **frontend/**: SvelteKit 2 + Svelte 5 app with Tailwind CSS v4, static adapter, better-auth
- **backend/**: Bun + Elysia API server with Drizzle ORM + PostgreSQL

## Commands
| Task | Frontend (`cd frontend`) | Backend (`cd backend`) |
|------|--------------------------|------------------------|
| Dev | `bun run dev` | `bun --watch src/index.ts` |
| Build | `bun run build` | `bun build src/index.ts --target bun --outdir ./dist` |
| Lint | `bun run lint` | — |
| Format | `bun run format` | — |
| Typecheck | `bun run check` | — |
| Test | — | `bun test` (single: `bun test <file>`) |

## Code Style
- Use tabs, single quotes, no trailing commas (Prettier configured in frontend)
- Frontend: Svelte 5 runes, TypeScript strict, Lucide icons
- Backend: Drizzle schemas in `schemas/`, snake_case for DB columns, camelCase in TS
- No comments unless complex; no `// @ts-expect-error` or `as any`
