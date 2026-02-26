// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextJest = require('next/jest');

const createJestConfig = nextJest({
    dir: './',
});

const customJestConfig = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testEnvironment: 'jest-environment-jsdom',
    // This is needed because we use aliased imports like @/lib/firebase/firebase-admin in tests
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },
};

module.exports = createJestConfig(customJestConfig);

