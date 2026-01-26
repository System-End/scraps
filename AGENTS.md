# AGENTS.md

## Commands
- `bun dev` - Start development server
- `bun run build` - Build for production
- `bun run check` - TypeScript/Svelte type checking
- `bun run lint` - Run Prettier + ESLint
- `bun run format` - Auto-format with Prettier

## Architecture
- **Framework**: SvelteKit 2 with Svelte 5, TypeScript, Tailwind CSS v4
- **Structure**: `src/routes/` for pages, `src/lib/` for shared code (import via `$lib/`)
- **Styling**: Tailwind CSS with `@tailwindcss/typography`, styles in `src/routes/layout.css`

## Code Style
- Use tabs for indentation, single quotes, no trailing commas
- 100 char line width
- TypeScript strict mode; avoid `any` and `@ts-ignore`
- Svelte 5 runes syntax (`$state`, `$derived`, `$effect`)
- Import shared code from `$lib/`; place reusable components in `src/lib/`
