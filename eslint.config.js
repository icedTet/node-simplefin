import js from '@eslint/js';
import { builtinModules } from 'node:module';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ['**/*.ts'],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
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
        { patterns: ['node:*', ...builtinModules, ...builtinModules.map((m) => `${m}/*`)] },
      ],
      'no-restricted-globals': ['error', 'process', 'Buffer', '__dirname', '__filename', 'global'],
    },
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
