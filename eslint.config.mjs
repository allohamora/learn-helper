// @ts-check
import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import beautifulSort from 'eslint-plugin-beautiful-sort';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginBetterTailwindcss from 'eslint-plugin-better-tailwindcss';
import { defineConfig } from 'eslint/config';
import { join } from 'node:path';

export default defineConfig(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // TODO: add eslint-plugin-react and eslint-plugin-jsx-a11y once (if) they support eslint 10
  reactHooks.configs.flat.recommended,
  eslintPluginBetterTailwindcss.configs.recommended,
  beautifulSort.configs.recommended,
  eslintPluginPrettierRecommended,
  { ignores: ['node_modules', 'dist', '**/routeTree.gen.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser }, parserOptions: { project: true } },
    settings: {
      'better-tailwindcss': {
        entryPoint: join(import.meta.dirname, 'src', 'styles.css'),
      },
    },
    rules: {
      'no-use-before-define': 'warn',
      'object-shorthand': 'warn',
      'no-async-promise-executor': 'warn',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/no-deprecated': 'error',
      'better-tailwindcss/no-unknown-classes': ['error', { ignore: ['^toaster$'] }],
      // This rule adds about five seconds to a full-project lint run.
      'better-tailwindcss/enforce-canonical-classes': 'off',
      'better-tailwindcss/enforce-consistent-line-wrapping': 'off',

      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExpressionStatement[directive="use client"]',
          message: 'Remove unnecessary "use client" directive.',
        },
        {
          selector: 'ExpressionStatement[directive="use server"]',
          message: 'Remove unnecessary "use server" directive.',
        },
      ],

      'beautiful-sort/import': [
        'error',
        {
          special: ['./mocks', '@tanstack/react-start/server-only', '@tanstack/react-start/client-only', 'react'],
          order: ['special', 'namespace', 'default', 'defaultObj', 'obj', 'none'],
        },
      ],
    },
  },
);
