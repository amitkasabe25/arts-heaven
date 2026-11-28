module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/worker.ts',
    '!src/scheduler.ts',
    '!src/**/dto/**',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/test/e2e/'],
  coverageDirectory: './coverage',
  verbose: false,
};
