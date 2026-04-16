export default {
  test: {
    environment: 'node',
    testTimeout: 10000,
    setupFiles: ['./test/setup.js'],
    maxWorkers: 1,
  },
};
