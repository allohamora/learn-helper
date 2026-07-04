// @ts-check
import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import beautifulSort from 'eslint-plugin-beautiful-sort';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // TODO: add eslint-plugin-react and eslint-plugin-jsx-a11y once (if) they support eslint 10
  reactHooks.configs.flat.recommended,
  beautifulSort.configs.recommended,
  eslintPluginPrettierRecommended,
  { ignores: ['node_modules', 'dist', '**/routeTree.gen.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser }, parserOptions: { project: true } },
    rules: {
      'no-use-before-define': ['error', { functions: false }],
      'object-shorthand': 'warn',
      'no-async-promise-executor': 'warn',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/no-deprecated': 'error',
    },
  },
);
