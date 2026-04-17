export default {
  test: {
    environment: 'node',
    testTimeout: 10000,
    setupFiles: ['./test/setup.js'],
    maxWorkers: 1,
    /** Playwright specs live here; they must run via `npm run test:e2e`, not Vitest */
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
};
