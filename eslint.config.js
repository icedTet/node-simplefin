import js from '@eslint/js';
import { builtinModules } from 'node:module';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

// Bare (non-node:-prefixed, non-relative) imports of any Node builtin, incl. subpaths.
const builtinBases = [...new Set(builtinModules.map((m) => m.split('/')[0]))];
const bareBuiltinRegex = `^(?!\\.|node:)(?:${builtinBases.join('|')})(?:/.*)?$`;

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      // src must stay isomorphic even if a dependency leaks node types into the program
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ regex: '^node:' }, { regex: bareBuiltinRegex }],
        },
      ],
      'no-restricted-globals': ['error', 'process', 'Buffer', '__dirname', '__filename', 'global'],
    },
  },
  {
    // noUncheckedIndexedAccess forces ! on indexed reads; in tests these are assertions
    files: ['test/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { parserOptions: { projectService: false } },
    // URL/console etc. exist in every target runtime (Node/Bun/Deno/browser)
    rules: { 'no-undef': 'off' },
  },
  prettierConfig,
);
