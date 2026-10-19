import { defineConfig } from 'vitest/config';

const unitInclude = ['test/unit/**/*.test.ts'];
const integrationInclude = process.env.SIMPLEFIN_INTEGRATION
  ? ['test/integration/**/*.test.ts']
  : [];

export default defineConfig({
  test: {
    environment: 'node',
    include: [...unitInclude, ...integrationInclude],
    exclude: ['node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
