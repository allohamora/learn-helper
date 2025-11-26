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

## Structure & Conventions

Directory highlights:

```text
src/
├── actions/               # Server-side actions
├── components/            # UI + feature components
│   └── ui/                # Shadcn/Ui primitives (buttons, inputs, toasts, etc.)
├── data/                  # Static learning datasets (Oxford lists)
├── hooks/                 # Custom React hooks (e.g., toast system)
├── layouts/               # Astro layout shells
├── lib/                   # Utilities & cross-cutting helpers
├── middleware.ts          # (Astro) auth / routing middleware entry
├── pages/                 # Astro pages (SSR / static)
├── styles/                # Global CSS & Tailwind layers
```

## Scripts

From `package.json`:

- `dev` – Start Astro dev server
- `build` – Production build
- `preview` – Preview built output
- `astro` – Direct Astro CLI access
- `prepare` – Husky install hook
- `format` / `format:fix` – Prettier check / write
- `lint` / `lint:fix` – ESLint check / fix (`ts`, `tsx`, `astro`)
- `csslint` / `csslint:fix` – Stylelint check / fix (`css`, `ts`, `tsx` for styled content)

## Instructions

- Install new dependencies by npm install commands; do NOT manually edit package.json or package-lock.json.
- Write comments only when necessary to clarify complex logic; prefer self-documenting code.
- Use `context7` mcp tools to get latest docs of the libraries before use them.
- Use `shadcn` CLI commands to install or update UI components; do NOT write component source from the memory.
- Use Astro Actions (`src/actions`) instead of adding bespoke API endpoint routes; implement server logic in actions and invoke them from forms/components to keep a unified server boundary.
- When editing prompts, follow the same prompt style and formatting to maintain consistency.
