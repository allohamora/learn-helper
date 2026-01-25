# Learn Helper

The Learn Helper is an **Astro + React** application focused on English learning.

## Tech Stack

- **Astro 5**: Full-stack framework with hybrid content + islands architecture
- **React 19**: Interactive UI islands & concurrent features
- **TypeScript**: End-to-end static typing
- **Tailwind CSS v4**: Utility-first styling with CSS layering & `@apply` minimization
- **Shadcn/Ui**: Accessible, composable component primitives styled with Tailwind and project design tokens
- **Clerk**: Authentication & user session management (`@clerk/astro`)
- **React Hook Form**: Performant form state management
- **Zod**: Schema-based validation & type inference
- **ESLint / Prettier / Stylelint**: Consistent formatting & linting
- **Husky + lint-staged + Commitlint**: Pre-commit & commit message quality gates
- **Modules (ESM)**: Native module interoperability

## Project Structure

Directory highlights:

```text
src/
├── actions/               # Server-side actions
├── components/            # UI + feature components
│   └── ui/                # shadcn/ui primitives
├── hooks/                 # Custom React hooks
├── layouts/               # Astro layout shells
├── lib/                   # Utilities and shared helpers
├── middleware.ts          # Astro auth/routing middleware
├── pages/                 # Astro routes (SSR/static)
├── styles/                # Global CSS and Tailwind layers
db/
├── config.ts              # Astro DB config
├── seed.ts                # Database seeding script
└── data/                  # Oxford datasets (JSON)
```

## Scripts

From `package.json`:

- `dev` – Start Astro dev server
- `build` – Production build
- `check` – Astro type check
- `format` / `format:fix` – Prettier check / write
- `lint` / `lint:fix` – ESLint check / fix (`ts`, `tsx`, `astro`)
- `csslint` / `csslint:fix` – Stylelint check / fix (`css`, `ts`, `tsx` for styled content)
- `test` – Unit tests (`**/__tests__/unit/**/*.spec.ts`)
- `test:integration` – Integration tests (`**/__tests__/integration/**/*.spec.ts`)
- `test:evals` – Evals tests (`**/__tests__/evals/**/*.spec.ts`)

Run a single test file:

- `npm run test -- __tests__/unit/path/to/foo.spec.ts`
- `npm run test:integration -- __tests__/integration/path/to/foo.spec.ts`
- `npm run test:evals -- __tests__/evals/path/to/foo.spec.ts`

Run a single test by name:

- `npm run test -- -t "test name"`
- `npm run test:integration -- -t "test name"`
- `npm run test:evals -- -t "test name"`

## Instructions

- Install new dependencies by npm install commands; do NOT manually edit package.json or package-lock.json.
- Write comments only when necessary to clarify complex logic; prefer self-documenting code.
- Use `context7` mcp tools to get latest docs of the libraries before use them.
- Use `shadcn` CLI commands to install or update UI components; do NOT write component source from the memory.
- Use Astro Actions (`src/actions`) instead of adding bespoke API endpoint routes; implement server logic in actions and invoke them from forms/components to keep a unified server boundary.
- Use `for...of` loops instead of `forEach` for better performance and readability.
- Avoid single-letter or one-word variable names; use descriptive names that clearly indicate purpose (e.g., `task` instead of `t`, `words` instead of `w`).
- Do NOT use the non-null assertion operator (`!`) in TypeScript; instead, use proper type guards, optional chaining, or refactor to handle null/undefined cases explicitly.
- After changes, update tests and docs when needed to keep behavior and documentation aligned.
